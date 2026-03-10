/**
 * 🔒 File Security Utilities
 *
 * دوال مساعدة لحماية رفع الملفات
 */

/**
 * تنظيف اسم الملف من Path Traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    throw new Error('Filename is required');
  }

  // إزالة path traversal patterns
  let sanitized = filename
    .replace(/\.\./g, '') // إزالة ..
    .replace(/\.\.\/\.\./g, '') // إزالة ../../
    .replace(/\.\.\\\.\./g, '') // إزالة ..\..\
    .replace(/[\/\\]/g, '') // إزالة / و \
    .trim();

  // السماح فقط بحروف آمنة: a-z, A-Z, 0-9, -, _, .
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');

  // الحد من الطول
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  // التأكد من أن الملف ليس فارغاً
  if (!sanitized) {
    throw new Error('Invalid filename after sanitization');
  }

  return sanitized;
}

/**
 * التحقق من أن المسار ضمن المجلد المحدد (حماية من Path Traversal)
 */
export function validateFilePath(
  filePath: string,
  allowedDirectory: string,
): boolean {
  const path = require('path');
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowed = path.resolve(allowedDirectory);

  // يجب أن يبدأ المسار بالمسار المسموح
  return resolvedPath.startsWith(resolvedAllowed);
}

/**
 * إنشاء اسم ملف آمن من UUID
 */
export function generateSecureFilename(extension: string = 'webp'): string {
  const { v4: uuidv4 } = require('uuid');

  // تنظيف extension
  const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  return `${uuidv4()}.${cleanExtension}`;
}
