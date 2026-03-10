import { fileTypeFromBuffer } from 'file-type';
import { BadRequestException } from '@nestjs/common';

/**
 * 🔒 File Validation Utilities
 *
 * دوال مساعدة للتحقق من نوع الملف الفعلي باستخدام Magic Bytes
 */

/**
 * قائمة MIME types المسموح بها
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

export const ALLOWED_MEDIA_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
] as const;

/**
 * 🔒 التحقق من نوع الملف الفعلي باستخدام Magic Bytes
 *
 * @param fileBuffer - Buffer للملف
 * @param allowedTypes - قائمة بـ MIME types المسموح بها
 * @returns MIME type الفعلي للملف
 * @throws BadRequestException إذا كان نوع الملف غير مسموح
 */
export async function validateFileType(
  fileBuffer: Buffer,
  allowedTypes: readonly string[],
): Promise<string> {
  // التحقق من وجود buffer
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new BadRequestException('Invalid file: empty buffer');
  }

  // التحقق من نوع الملف الفعلي باستخدام Magic Bytes
  const fileType = await fileTypeFromBuffer(fileBuffer);

  if (!fileType) {
    throw new BadRequestException(
      'Unable to determine file type. File may be corrupted or invalid.',
    );
  }

  // التحقق من أن نوع الملف مسموح
  if (!allowedTypes.includes(fileType.mime)) {
    throw new BadRequestException(
      `Invalid file type: ${fileType.mime}. Allowed types: ${allowedTypes.join(', ')}`,
    );
  }

  return fileType.mime;
}

/**
 * 🔒 التحقق من نوع الملف (صورة)
 */
export async function validateImageType(fileBuffer: Buffer): Promise<string> {
  return validateFileType(fileBuffer, ALLOWED_IMAGE_TYPES);
}

/**
 * 🔒 التحقق من نوع الملف (وثيقة)
 */
export async function validateDocumentType(
  fileBuffer: Buffer,
): Promise<string> {
  return validateFileType(fileBuffer, ALLOWED_DOCUMENT_TYPES);
}

/**
 * 🔒 التحقق من نوع الملف (وسائط)
 */
export async function validateMediaType(fileBuffer: Buffer): Promise<string> {
  return validateFileType(fileBuffer, ALLOWED_MEDIA_TYPES);
}

/**
 * 🔒 التحقق من نوع الملف (صور + وثائق + وسائط)
 */
export async function validateMixedFileType(
  fileBuffer: Buffer,
): Promise<string> {
  const allAllowedTypes = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
    ...ALLOWED_MEDIA_TYPES,
  ];
  return validateFileType(fileBuffer, allAllowedTypes);
}
