import { customAlphabet } from 'nanoid';

/**
 * أداة إنشاء معرفات آمنة ومشفرة
 *
 * المميزات:
 * - أقصر من UUID (21 حرف بدلاً من 36)
 * - Entropy أعلى (126 بت)
 * - URL-safe بدون encoding
 * - لا يكشف معلومات عن وقت الإنشاء
 * - صعب التخمين جداً
 */

// الأحرف المستخدمة: a-z, A-Z, 0-9, _ و -
// 64 حرف = 6 بت لكل حرف
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

// 21 حرف × 6 بت = 126 بت entropy (أكثر من UUID v4 الذي يوفر 122 بت)
const DEFAULT_SIZE = 21;

/**
 * إنشاء معرف آمن عام
 * @example generateSecureId() => "V1StGXR8_Z5jdHi6B-myT"
 */
export const generateSecureId = customAlphabet(ALPHABET, DEFAULT_SIZE);

/**
 * إنشاء معرف مخصص الطول
 * @param size طول المعرف
 */
export const generateCustomId = (size: number) =>
  customAlphabet(ALPHABET, size)();

/**
 * معرفات محددة لكل نوع entity
 * كل نوع له prefix مميز لسهولة التعرف
 */
export const SecureIds = {
  /** معرف نموذج: frm_xxxx */
  form: () => `frm_${generateSecureId()}`,

  /** معرف حقل: fld_xxxx */
  field: () => `fld_${generateSecureId()}`,

  /** معرف إرسال: sub_xxxx */
  submission: () => `sub_${generateSecureId()}`,

  /** معرف حدث: evt_xxxx */
  event: () => `evt_${generateSecureId()}`,

  /** معرف متجر: str_xxxx */
  store: () => `str_${generateSecureId()}`,

  /** معرف منتج: prd_xxxx */
  product: () => `prd_${generateSecureId()}`,

  /** معرف طلب: ord_xxxx */
  order: () => `ord_${generateSecureId()}`,

  /** معرف مستخدم: usr_xxxx */
  user: () => `usr_${generateSecureId()}`,

  /** معرف جلسة: ses_xxxx */
  session: () => `ses_${generateSecureId()}`,

  /** معرف توكن: tok_xxxx */
  token: () => `tok_${generateSecureId()}`,

  /** معرف عام بدون prefix */
  generic: () => generateSecureId(),
};

/**
 * التحقق من صحة معرف آمن
 */
export function isValidSecureId(id: string): boolean {
  // التحقق من الطول والأحرف المسموحة
  const pattern = /^[A-Za-z0-9_-]+$/;
  return pattern.test(id) && id.length >= 21;
}

/**
 * التحقق من صحة معرف مع prefix
 */
export function isValidPrefixedId(id: string, prefix: string): boolean {
  if (!id.startsWith(`${prefix}_`)) return false;
  const idPart = id.substring(prefix.length + 1);
  return isValidSecureId(idPart);
}

export default SecureIds;
