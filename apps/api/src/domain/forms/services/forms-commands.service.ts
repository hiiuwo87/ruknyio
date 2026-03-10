import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { RedisService } from '../../../core/cache/redis.service';
import { S3Service } from '../../../services/s3.service';
import { CreateFormDto, UpdateFormDto, FormStatus } from '../dto';
import { SecureIds } from '../../../core/common/utils/secure-id.util';
import { EmailService } from '../../../integrations/email/email.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * 📝 Forms Commands Service
 * Handles: create, update, delete, updateStatus, duplicate
 *
 * ~300 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class FormsCommandsService {
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';
  private readonly FORM_COVER_WIDTH = 1200;
  private readonly FORM_COVER_HEIGHT = 630;
  private readonly MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private s3Service: S3Service,
    private emailService: EmailService,
  ) {}

  /**
   * Create a new form
   * Images are processed outside the transaction to keep it short; email is sent asynchronously.
   */
  async create(userId: string, createFormDto: CreateFormDto) {
    const uniqueSlug = await this.generateUniqueSlug(createFormDto.slug);
    await this.validateLinkedEntities(userId, createFormDto);

    const {
      fields,
      steps,
      coverImage,
      bannerImages,
      bannerDisplayMode,
      ...formData
    } = createFormDto;
    const isMultiStep = formData.isMultiStep || (steps && steps.length > 0);
    const formId = SecureIds.form();

    // Process images outside transaction to avoid long-running transaction
    const coverImageKey = coverImage
      ? await this.processCoverImage(coverImage, userId, formId)
      : undefined;
    const bannerImageKeys = bannerImages?.length
      ? await this.processBannerImages(bannerImages, userId, formId)
      : [];

    const form = await this.prisma.$transaction(async (tx) => {
      await tx.form.create({
        data: {
          id: formId,
          ...formData,
          slug: uniqueSlug,
          coverImage: coverImageKey || (bannerImageKeys[0] ?? undefined),
          bannerImages: bannerImageKeys,
          bannerDisplayMode: bannerDisplayMode || 'single',
          userId,
          status: formData.status || 'DRAFT',
          isMultiStep: isMultiStep || false,
        },
      });

      await this.createFormFieldsAndSteps(
        tx,
        formId,
        fields,
        steps,
        isMultiStep,
      );

      return tx.form.findUnique({
        where: { id: formId },
        include: this.getFormInclude(),
      });
    });

    // Send notification email asynchronously (do not block response)
    void this.sendFormCreatedEmail(form).catch((e) =>
      console.error('Form created email failed:', e),
    );

    await this.invalidateUserCache(form?.userId);
    return form;
  }

  /**
   * Update a form
   */
  async update(userId: string, formId: string, updateFormDto: UpdateFormDto) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    // Check slug uniqueness if changed
    if (updateFormDto.slug && updateFormDto.slug !== form.slug) {
      const existing = await this.prisma.form.findUnique({
        where: { slug: updateFormDto.slug },
      });
      if (existing) throw new ConflictException('Slug already taken');
    }

    const { fields, steps, coverImage, bannerImages, ...formData } =
      updateFormDto;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Process cover image
      let coverImageKey = form.coverImage;
      if (coverImage !== undefined) {
        coverImageKey = coverImage
          ? await this.processCoverImage(coverImage, userId, formId)
          : null;
      }

      // Process banner images
      let bannerImageKeys = form.bannerImages;
      if (bannerImages !== undefined) {
        bannerImageKeys = await this.processBannerImages(
          bannerImages || [],
          userId,
          formId,
        );
      }

      // Update form
      await tx.form.update({
        where: { id: formId },
        data: {
          ...formData,
          coverImage: coverImageKey,
          bannerImages: bannerImageKeys,
        },
      });

      // Update fields if provided
      if (fields) {
        await tx.formField.deleteMany({ where: { formId } });
        for (const field of fields) {
          await tx.formField.create({
            data: {
              id: SecureIds.field(),
              formId,
              ...this.mapFieldData(field),
            },
          });
        }
      }

      return tx.form.findUnique({
        where: { id: formId },
        include: this.getFormInclude(),
      });
    });

    await this.invalidateUserCache(updated?.userId);
    return this.transformCoverImage(updated);
  }

  /**
   * Update form status
   */
  async updateStatus(userId: string, formId: string, status: FormStatus) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    const updated = await this.prisma.form.update({
      where: { id: formId },
      data: { status },
    });

    await this.invalidateUserCache(updated?.userId);
    return updated;
  }

  /**
   * Delete a form
   */
  async delete(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    await this.prisma.form.delete({ where: { id: formId } });
    await this.invalidateUserCache(form.userId);
  }

  /**
   * Duplicate a form
   */
  async duplicate(userId: string, formId: string) {
    const original = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { fields: true },
    });

    if (!original) throw new NotFoundException('Form not found');
    if (original.userId !== userId)
      throw new ForbiddenException('Not authorized');

    // Generate unique slug
    const slug = await this.generateUniqueSlug(`${original.slug}-copy`);

    const {
      id,
      createdAt,
      updatedAt,
      viewCount,
      submissionCount,
      ...formData
    } = original;

    return this.prisma.form.create({
      data: {
        ...formData,
        title: `${original.title} (Copy)`,
        slug,
        status: 'DRAFT',
        viewCount: 0,
        submissionCount: 0,
        fields: {
          create: original.fields.map(
            ({ id, formId, createdAt, updatedAt, ...field }) => field,
          ),
        },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
  }

  // ============ Private Helpers ============

  private async validateLinkedEntities(userId: string, dto: CreateFormDto) {
    if (dto.linkedEventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: dto.linkedEventId },
      });
      if (!event || event.userId !== userId) {
        throw new NotFoundException('Linked event not found or unauthorized');
      }
    }

    if (dto.linkedStoreId) {
      const store = await this.prisma.store.findUnique({
        where: { id: dto.linkedStoreId },
      });
      if (!store || store.userId !== userId) {
        throw new NotFoundException('Linked store not found or unauthorized');
      }
    }
  }

  private async createFormFieldsAndSteps(
    tx: any,
    formId: string,
    fields?: any[],
    steps?: any[],
    isMultiStep?: boolean,
  ) {
    if (isMultiStep && steps?.length) {
      for (const step of steps) {
        const stepId = SecureIds.generic();
        await tx.form_steps.create({
          data: {
            id: stepId,
            formId,
            title: step.title,
            description: step.description,
            order: step.order,
            updatedAt: new Date(),
          },
        });

        if (step.fields?.length) {
          await tx.formField.createMany({
            data: step.fields.map((field: any) => ({
              id: SecureIds.field(),
              formId,
              stepId,
              ...this.mapFieldData(field),
            })),
          });
        }
      }
    } else if (fields?.length) {
      await tx.formField.createMany({
        data: fields.map((field: any) => ({
          id: SecureIds.field(),
          formId,
          ...this.mapFieldData(field),
        })),
      });
    }
  }

  private mapFieldData(field: any) {
    return {
      label: field.label,
      description: field.description || null,
      type: field.type,
      order: field.order,
      required: field.required ?? false,
      placeholder: field.placeholder || null,
      options: field.options || null,
      minValue: field.minValue ?? null,
      maxValue: field.maxValue ?? null,
      allowedFileTypes: field.allowedFileTypes || [],
      maxFileSize: field.maxFileSize ?? null,
      maxFiles: field.maxFiles ?? null,
    };
  }

  private async processCoverImage(
    coverImage: string,
    userId: string,
    formId: string,
  ): Promise<string | undefined> {
    if (!coverImage) return undefined;
    if (
      coverImage.startsWith('http') ||
      coverImage.startsWith('users/') ||
      coverImage.startsWith('forms/')
    ) {
      return coverImage;
    }

    let normalized = coverImage;
    if (coverImage.startsWith('image/') && coverImage.includes(';base64,')) {
      normalized = 'data:' + coverImage;
    }

    if (!normalized.startsWith('data:image/')) return coverImage;

    const matches = normalized.match(/^data:image\/([\w+]+);base64,(.+)$/);
    if (!matches) throw new BadRequestException('Invalid image format');

    const [, , base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > this.MAX_COVER_SIZE) {
      throw new BadRequestException('Cover image exceeds 5MB limit');
    }

    const sharp = await import('sharp');
    const processed = await sharp
      .default(buffer)
      .resize(this.FORM_COVER_WIDTH, this.FORM_COVER_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    const s3Key = `users/${userId}/forms/${formId}/cover/${uuidv4()}.webp`;
    await this.s3Service.uploadBuffer(
      this.bucket,
      s3Key,
      processed,
      'image/webp',
    );

    return s3Key;
  }

  private async processBannerImages(
    images: string[],
    userId: string,
    formId: string,
  ): Promise<string[]> {
    const results: string[] = [];
    for (const img of images) {
      const processed = await this.processCoverImage(img, userId, formId);
      if (processed) results.push(processed);
    }
    return results;
  }

  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.form.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return slug;
  }

  private async sendFormCreatedEmail(form: any) {
    if (form?.user?.email) {
      try {
        const userName =
          form.user.profile?.name || form.user.email.split('@')[0];
        await this.emailService.sendFormCreatedNotification(
          form.user.email,
          userName,
          {
            formTitle: form.title,
            formSlug: form.slug,
            formId: form.id,
          },
        );
      } catch (e) {
        console.error('Error sending form created notification:', e);
      }
    }
  }

  private async invalidateUserCache(userId?: string) {
    if (userId) {
      try {
        await this.redisService.del(`dashboard:stats:${userId}`);
      } catch (e) {
        console.warn('Redis del error:', e);
      }
    }
  }

  private async transformCoverImage(form: any) {
    if (form?.coverImage && !form.coverImage.startsWith('http')) {
      try {
        const url = await this.s3Service.getPresignedGetUrl(
          this.bucket,
          form.coverImage,
          3600,
        );
        return { ...form, coverImage: url };
      } catch (e) {
        return { ...form, coverImage: null };
      }
    }
    return form;
  }

  private getFormInclude() {
    return {
      fields: { orderBy: { order: 'asc' as const } },
      steps: {
        orderBy: { order: 'asc' as const },
        include: { form_fields: { orderBy: { order: 'asc' as const } } },
      },
      _count: { select: { submissions: true } },
      user: { include: { profile: true } },
    };
  }
}
