import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { SubmitFormDto } from '../dto';
import { ValidationService } from '../../../core/common/validation.service';
import { ConditionalLogicService } from './conditional-logic.service';
import { WebhookService } from './webhook.service';
import { SecureIds } from '../../../core/common/utils/secure-id.util';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationType } from '@prisma/client';
import { GoogleDriveService } from '../../../integrations/google-drive/google-drive.service';
import { RecaptchaEnterpriseService } from '../../../infrastructure/security/recaptcha-enterprise.service';

/**
 * 📨 Forms Submission Service
 * Handles: submitForm, validateSubmission, processSubmissionData
 *
 * ~300 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class FormsSubmissionService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private validationService: ValidationService,
    private conditionalLogicService: ConditionalLogicService,
    private webhookService: WebhookService,
    private notificationsGateway: NotificationsGateway,
    private recaptchaService: RecaptchaEnterpriseService,
    @Inject(forwardRef(() => GoogleDriveService))
    private googleDriveService: GoogleDriveService,
  ) {}

  /**
   * Submit a form response
   */
  async submitForm(
    formId: string,
    submitFormDto: SubmitFormDto,
    userId?: string,
  ) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { fields: true },
    });

    if (!form) throw new NotFoundException('Form not found');

    // Validate submission
    await this.validateSubmission(form, userId);

    // Verify reCAPTCHA Enterprise if token is provided
    if (submitFormDto.data?.recaptchaToken) {
      try {
        const recaptchaResult = await this.recaptchaService.verifyToken(
          submitFormDto.data.recaptchaToken,
          'FORM_SUBMIT'
        );
        
        if (!recaptchaResult.success) {
          throw new BadRequestException({
            message: 'reCAPTCHA verification failed',
            code: 'RECAPTCHA_FAILED',
            details: {
              score: recaptchaResult.score,
              error: recaptchaResult.error
            }
          });
        }
        
        // Remove reCAPTCHA token from form data before processing
        delete submitFormDto.data.recaptchaToken;
        
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException({
          message: 'reCAPTCHA verification failed',
          code: 'RECAPTCHA_ERROR',
          details: error.message
        });
      }
    }

    // Apply conditional logic
    const { visibleFieldIds, requiredFieldIds } =
      this.conditionalLogicService.getVisibleFields(
        form.fields,
        submitFormDto.data,
      );

    // Filter and validate fields
    const fieldsToValidate = form.fields
      .filter((f) => visibleFieldIds.includes(f.id))
      .map((f) => ({
        ...f,
        required: requiredFieldIds.includes(f.id) || f.required,
      }));

    const validation = this.validationService.validateFormSubmission(
      fieldsToValidate,
      submitFormDto.data,
    );
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validation.errors,
        errorMessages: this.validationService.flattenErrors(validation.errors),
      });
    }

    // Generate submission ID
    const submissionId = SecureIds.submission();

    // Process files and signatures (async-friendly)
    const processedData = await this.processSubmissionData(
      formId,
      form.fields,
      submitFormDto.data,
      submissionId,
    );

    // Create submission
    const submission = await this.prisma.form_submissions.create({
      data: {
        id: submissionId,
        formId,
        userId,
        data: processedData,
        ipAddress: submitFormDto.ipAddress,
        userAgent: submitFormDto.userAgent,
        timeToComplete: submitFormDto.timeToComplete,
        updatedAt: new Date(),
      },
    });

    // Update submission count
    await this.prisma.form.update({
      where: { id: formId },
      data: { submissionCount: { increment: 1 } },
    });

    // Send notifications (non-blocking)
    this.sendNotifications(form, submission, submitFormDto.data).catch(
      console.error,
    );

    return submission;
  }

  /**
   * Get form submissions with cursor pagination
   */
  async getSubmissions(
    userId: string,
    formId: string,
    options?: { cursor?: string; limit?: number; search?: string },
  ) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    const limit = Math.min(options?.limit || 50, 100);

    const submissions = await this.prisma.form_submissions.findMany({
      where: { formId },
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    const hasMore = submissions.length > limit;
    const data = hasMore ? submissions.slice(0, limit) : submissions;

    return {
      submissions: data,
      pagination: {
        hasMore,
        nextCursor:
          hasMore && data.length > 0 ? data[data.length - 1].id : null,
        total: await this.prisma.form_submissions.count({ where: { formId } }),
      },
    };
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(userId: string, formId: string, submissionId: string) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    const submission = await this.prisma.form_submissions.findUnique({
      where: { id: submissionId, formId },
    });

    if (!submission) throw new NotFoundException('Submission not found');

    await this.prisma.form_submissions.delete({ where: { id: submissionId } });
    await this.prisma.form.update({
      where: { id: formId },
      data: { submissionCount: { decrement: 1 } },
    });
  }

  // ============ Private Helpers ============

  private async validateSubmission(form: any, userId?: string) {
    if (form.status !== 'PUBLISHED') {
      throw new BadRequestException('Form is not accepting submissions');
    }

    const now = new Date();
    if (form.opensAt && now < form.opensAt) {
      throw new BadRequestException('Form is not open yet');
    }
    if (form.closesAt && now > form.closesAt) {
      throw new BadRequestException('Form is closed');
    }

    if (form.requiresAuthentication && !userId) {
      throw new BadRequestException('Authentication required');
    }

    if (form.maxSubmissions) {
      const count = await this.prisma.form_submissions.count({
        where: { formId: form.id },
      });
      if (count >= form.maxSubmissions) {
        throw new BadRequestException('Form has reached maximum submissions');
      }
    }

    if ((!form.allowMultipleSubmissions || form.oneResponsePerUser) && userId) {
      const existing = await this.prisma.form_submissions.findFirst({
        where: { formId: form.id, userId },
      });
      if (existing) {
        throw new BadRequestException('You have already submitted this form');
      }
    }
  }

  private async sendNotifications(form: any, submission: any, data: any) {
    // Real-time notification to form owner
    try {
      await this.notificationsGateway.sendNotification({
        userId: form.userId,
        type: NotificationType.FORM_SUBMISSION,
        title: 'استجابة نموذج جديدة',
        message: `تم استلام استجابة جديدة على النموذج "${form.title}"`,
        data: {
          formId: form.id,
          formTitle: form.title,
          formSlug: form.slug,
          submissionId: submission.id,
          responseCount: (form.submissionCount || 0) + 1,
        },
      });
    } catch (e) {
      console.error('Failed to send real-time notification:', e);
    }

    // Webhook notification
    if (form.webhookEnabled && form.webhookUrl) {
      try {
        await this.webhookService.notifyFormSubmission(
          form.webhookUrl,
          form.webhookSecret,
          form.id,
          form.slug,
          submission.id,
          data,
        );
      } catch (e) {
        console.error('Failed to send webhook:', e);
      }
    }
  }

  private async processSubmissionData(
    formId: string,
    fields: any[],
    data: Record<string, any>,
    submissionId: string,
  ): Promise<Record<string, any>> {
    const processedData = { ...data };
    const isDriveConnected = await this.isDriveConnected(formId);

    if (!isDriveConnected) return processedData;

    const apiUrl = this.config.get('API_URL') || 'http://localhost:3001';

    for (const field of fields) {
      const fieldKey =
        data[field.id] !== undefined
          ? field.id
          : data[field.label] !== undefined
            ? field.label
            : null;
      if (!fieldKey || !data[fieldKey]) continue;

      const value = data[fieldKey];

      try {
        // Process SIGNATURE fields
        if (field.type === 'SIGNATURE' && this.isBase64Image(value)) {
          const signatureData = this.normalizeBase64(value);
          const result = await this.googleDriveService.uploadSignature(
            formId,
            signatureData,
            submissionId,
          );
          processedData[fieldKey] = {
            type: 'secure_file',
            fileId: result.fileId,
            formId,
            webViewLink: result.webViewLink,
            secureUrl: `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${result.fileId}`,
          };
        }

        // Process FILE fields
        if (field.type === 'FILE') {
          processedData[fieldKey] = await this.processFileField(
            value,
            formId,
            submissionId,
            apiUrl,
          );
        }
      } catch (e) {
        console.error(`Error processing field ${field.id}:`, e);
      }
    }

    return processedData;
  }

  private async processFileField(
    value: any,
    formId: string,
    submissionId: string,
    apiUrl: string,
  ) {
    const files = Array.isArray(value) ? value : [value];
    const results: any[] = [];

    for (const file of files) {
      if (file.url || file.secureUrl || file.fileId) {
        results.push(file);
        continue;
      }

      const fileData = this.normalizeBase64(file.data);
      if (!fileData?.startsWith('data:')) {
        results.push(file);
        continue;
      }

      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = file.name || file.originalName || `file_${Date.now()}`;
      const fileType = file.type || file.mimeType || 'application/octet-stream';

      const result = await this.googleDriveService.uploadFile(
        formId,
        {
          buffer,
          originalname: fileName,
          mimetype: fileType,
        },
        submissionId,
      );

      results.push({
        name: fileName,
        type: fileType,
        size: file.size,
        fileId: result.fileId,
        formId,
        webViewLink: result.webViewLink,
        secureUrl: `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${result.fileId}`,
      });
    }

    return Array.isArray(value) ? results : results[0];
  }

  private isBase64Image(value: any): boolean {
    return (
      typeof value === 'string' &&
      (value.startsWith('data:image') || value.startsWith('image/'))
    );
  }

  private normalizeBase64(value: string): string {
    if (!value) return value;
    if (!value.startsWith('data:') && value.includes(';base64,')) {
      return `data:${value}`;
    }
    return value;
  }

  private async isDriveConnected(formId: string): Promise<boolean> {
    const integration = await this.prisma.formIntegration.findFirst({
      where: { formId, type: 'google_sheets', isActive: true },
    });
    return !!integration;
  }
}
