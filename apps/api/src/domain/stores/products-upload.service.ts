import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import S3Service from '../../services/s3.service';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

/**
 * خدمة رفع صور المنتجات إلى S3
 * تدعم:
 * - رفع مباشر من الخادم (Server Upload)
 * - رفع عبر Presigned URLs (Client Upload)
 * - معالجة الصور وتحويلها إلى WebP
 * - حذف الصور عند التحديث أو حذف المنتج
 */
@Injectable()
export class ProductsUploadService {
  private readonly logger = new Logger(ProductsUploadService.name);
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  // إعدادات الصور
  private readonly MAX_FILE_SIZE =
    Number(process.env.S3_PRODUCT_IMAGE_MAX_SIZE) || 5 * 1024 * 1024; // 5MB
  private readonly MAX_FILES =
    Number(process.env.S3_PRODUCT_IMAGE_MAX_COUNT) || 5;
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly IMAGE_WIDTH = 1200; // أقصى عرض للصورة
  private readonly IMAGE_QUALITY = 85; // جودة WebP

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * التحقق من ملكية المنتج
   */
  private async verifyProductOwnership(productId: string, userId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    if (product.stores?.userId !== userId) {
      throw new ForbiddenException('ليس لديك صلاحية لتعديل هذا المنتج');
    }

    return product;
  }

  /**
   * التحقق من صحة الملفات
   */
  validateFiles(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('لم يتم توفير أي ملفات');
    }

    if (files.length > this.MAX_FILES) {
      throw new BadRequestException(`الحد الأقصى ${this.MAX_FILES} صور فقط`);
    }

    for (const file of files) {
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `نوع الملف غير مسموح: ${file.mimetype}. الأنواع المسموحة: JPEG, PNG, WebP, GIF`,
        );
      }

      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `حجم الملف كبير جداً. الحد الأقصى: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }
    }
  }

  /**
   * بناء مفتاح S3 للصورة
   */
  buildImageKey(
    userId: string,
    productId: string,
    originalName: string,
  ): string {
    const ext = '.webp'; // نحول كل الصور إلى WebP
    const uuid = uuidv4();
    return `users/${userId}/products/${productId}/images/${uuid}${ext}`;
  }

  /**
   * معالجة الصورة وتحويلها إلى WebP
   */
  async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      // التحقق من صحة البيانات
      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('ملف الصورة فارغ');
      }

      this.logger.debug(`معالجة صورة بحجم: ${buffer.length} بايت`);

      // محاولة قراءة metadata للتحقق من صحة الصورة
      const metadata = await sharp(buffer).metadata();
      this.logger.debug(
        `نوع الصورة: ${metadata.format}, الأبعاد: ${metadata.width}x${metadata.height}`,
      );

      return await sharp(buffer)
        .resize(this.IMAGE_WIDTH, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: this.IMAGE_QUALITY })
        .toBuffer();
    } catch (error) {
      this.logger.error(`فشل معالجة الصورة: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`فشل معالجة الصورة: ${error.message}`);
    }
  }

  /**
   * رفع صور المنتج (Server Upload)
   */
  async uploadProductImages(
    userId: string,
    productId: string,
    files: Express.Multer.File[],
  ): Promise<{ keys: string[]; urls: string[] }> {
    // التحقق من الملكية
    const product = await this.verifyProductOwnership(productId, userId);
    const storeId = product.storeId;

    // Log file info for debugging
    this.logger.debug(`استلام ${files?.length || 0} ملفات للرفع`);
    files?.forEach((file, i) => {
      this.logger.debug(
        `ملف ${i + 1}: ${file.originalname}, النوع: ${file.mimetype}, الحجم: ${file.size}, حجم البافر: ${file.buffer?.length || 0}`,
      );
    });

    // التحقق من الملفات
    this.validateFiles(files);

    // التحقق من عدد الصور الحالية
    const existingImages = await this.prisma.product_images.count({
      where: { productId },
    });

    if (existingImages + files.length > this.MAX_FILES) {
      throw new BadRequestException(
        `لا يمكن إضافة ${files.length} صور. لديك ${existingImages} صور حالياً والحد الأقصى ${this.MAX_FILES}`,
      );
    }

    const uploadedKeys: string[] = [];
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // معالجة الصورة
        const processedBuffer = await this.processImage(file.buffer);

        // بناء المفتاح
        const key = this.buildImageKey(userId, productId, file.originalname);

        // رفع إلى S3
        await this.s3Service.uploadBuffer(
          this.bucket,
          key,
          processedBuffer,
          'image/webp',
        );

        uploadedKeys.push(key);

        // إنشاء URL
        const url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;
        uploadedUrls.push(url);

        this.logger.debug(`تم رفع الصورة: ${key}`);
      }

      // حفظ الصور في قاعدة البيانات
      const nextDisplayOrder = existingImages;
      await this.prisma.product_images.createMany({
        data: uploadedKeys.map((key, index) => ({
          id: uuidv4(),
          productId,
          imagePath: key, // نخزن المفتاح فقط
          displayOrder: nextDisplayOrder + index,
          isPrimary: existingImages === 0 && index === 0, // أول صورة تكون رئيسية
        })),
      });

      this.logger.log(`تم رفع ${files.length} صورة للمنتج ${productId}`);

      return { keys: uploadedKeys, urls: uploadedUrls };
    } catch (error) {
      // تنظيف الملفات المرفوعة في حال الفشل
      for (const key of uploadedKeys) {
        await this.s3Service.deleteObject(this.bucket, key);
      }
      throw error;
    }
  }

  /**
   * إنشاء Presigned URLs للرفع المباشر
   */
  async generatePresignedUrls(
    userId: string,
    productId: string,
    files: { name: string; type: string; size: number }[],
  ): Promise<{ uploads: { key: string; url: string }[] }> {
    // التحقق من الملكية
    const product = await this.verifyProductOwnership(productId, userId);
    const storeId = product.storeId;

    // التحقق من عدد الملفات
    if (files.length > this.MAX_FILES) {
      throw new BadRequestException(`الحد الأقصى ${this.MAX_FILES} صور فقط`);
    }

    // التحقق من الأنواع والأحجام
    for (const file of files) {
      if (!this.ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new BadRequestException(`نوع الملف غير مسموح: ${file.type}`);
      }
      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(`حجم الملف كبير جداً: ${file.name}`);
      }
    }

    // التحقق من عدد الصور الحالية
    const existingImages = await this.prisma.product_images.count({
      where: { productId },
    });

    if (existingImages + files.length > this.MAX_FILES) {
      throw new BadRequestException(
        `لا يمكن إضافة ${files.length} صور. لديك ${existingImages} صور حالياً`,
      );
    }

    const uploads: { key: string; url: string }[] = [];

    for (const file of files) {
      const key = this.buildImageKey(userId, productId, file.name);
      const url = await this.s3Service.getPresignedPutUrl(
        this.bucket,
        key,
        file.type,
        3600,
      );
      uploads.push({ key, url });
    }

    return { uploads };
  }

  /**
   * تأكيد رفع الصور بعد استخدام Presigned URLs
   */
  async confirmUpload(
    userId: string,
    productId: string,
    keys: string[],
  ): Promise<{ success: boolean; images: any[] }> {
    // التحقق من الملكية
    await this.verifyProductOwnership(productId, userId);

    // التحقق من عدد الصور الحالية
    const existingImages = await this.prisma.product_images.count({
      where: { productId },
    });

    // حفظ الصور في قاعدة البيانات
    const newImages = await this.prisma.product_images.createMany({
      data: keys.map((key, index) => ({
        id: uuidv4(),
        productId,
        imagePath: key,
        displayOrder: existingImages + index,
        isPrimary: existingImages === 0 && index === 0,
      })),
    });

    // جلب الصور المحدثة
    const images = await this.prisma.product_images.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    return { success: true, images };
  }

  /**
   * حذف صورة من المنتج
   */
  async deleteProductImage(
    userId: string,
    productId: string,
    imageId: string,
  ): Promise<{ success: boolean }> {
    // التحقق من الملكية
    await this.verifyProductOwnership(productId, userId);

    // جلب الصورة
    const image = await this.prisma.product_images.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== productId) {
      throw new NotFoundException('الصورة غير موجودة');
    }

    // حذف من S3
    await this.s3Service.deleteObject(this.bucket, image.imagePath);

    // حذف من قاعدة البيانات
    await this.prisma.product_images.delete({
      where: { id: imageId },
    });

    // إذا كانت الصورة الرئيسية، نجعل أول صورة متبقية رئيسية
    if (image.isPrimary) {
      const firstImage = await this.prisma.product_images.findFirst({
        where: { productId },
        orderBy: { displayOrder: 'asc' },
      });

      if (firstImage) {
        await this.prisma.product_images.update({
          where: { id: firstImage.id },
          data: { isPrimary: true },
        });
      }
    }

    this.logger.log(`تم حذف الصورة ${imageId} من المنتج ${productId}`);

    return { success: true };
  }

  /**
   * تعيين صورة كصورة رئيسية
   */
  async setPrimaryImage(
    userId: string,
    productId: string,
    imageId: string,
  ): Promise<{ success: boolean }> {
    // التحقق من الملكية
    await this.verifyProductOwnership(productId, userId);

    // جلب الصورة
    const image = await this.prisma.product_images.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== productId) {
      throw new NotFoundException('الصورة غير موجودة');
    }

    // إلغاء الصورة الرئيسية الحالية
    await this.prisma.product_images.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });

    // تعيين الصورة الجديدة كرئيسية
    await this.prisma.product_images.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    return { success: true };
  }

  /**
   * إعادة ترتيب الصور
   */
  async reorderImages(
    userId: string,
    productId: string,
    imageIds: string[],
  ): Promise<{ success: boolean }> {
    // التحقق من الملكية
    await this.verifyProductOwnership(productId, userId);

    // تحديث ترتيب الصور
    await Promise.all(
      imageIds.map((id, index) =>
        this.prisma.product_images.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return { success: true };
  }

  /**
   * حذف جميع صور المنتج (يستخدم عند حذف المنتج)
   */
  async deleteAllProductImages(productId: string): Promise<void> {
    const images = await this.prisma.product_images.findMany({
      where: { productId },
    });

    // حذف من S3
    for (const image of images) {
      await this.s3Service.deleteObject(this.bucket, image.imagePath);
    }

    // حذف من قاعدة البيانات
    await this.prisma.product_images.deleteMany({
      where: { productId },
    });

    this.logger.log(`تم حذف جميع صور المنتج ${productId}`);
  }

  /**
   * الحصول على URLs للصور (Presigned GET للـ buckets الخاصة)
   */
  async getProductImageUrls(
    productId: string,
  ): Promise<{ images: { id: string; url: string; isPrimary: boolean }[] }> {
    const images = await this.prisma.product_images.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    const result = await Promise.all(
      images.map(async (img) => {
        let url = img.imagePath;

        // إذا كان المفتاح يبدأ بـ http، فهو URL كامل بالفعل
        if (!img.imagePath.startsWith('http')) {
          // إنشاء presigned GET URL للوصول للصور الخاصة
          // صلاحية URL = ساعة واحدة (3600 ثانية)
          try {
            url = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              img.imagePath,
              3600,
            );
          } catch (error) {
            this.logger.warn(
              `Failed to generate presigned URL for ${img.imagePath}: ${error}`,
            );
            // Fallback to public URL format
            url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${img.imagePath}`;
          }
        }

        return {
          id: img.id,
          url,
          isPrimary: img.isPrimary,
          displayOrder: img.displayOrder,
        };
      }),
    );

    return { images: result };
  }
}
