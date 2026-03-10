import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * 🔒 Input Length Limiter Pipe
 *
 * يحدد الحد الأقصى لطول المدخلات لمنع DoS attacks
 * ومنع إرسال بيانات ضخمة للخادم
 */
@Injectable()
export class InputLengthPipe implements PipeTransform {
  // الحدود الافتراضية لكل نوع
  private readonly DEFAULT_LIMITS = {
    string: 10000,        // 10KB للنصوص العادية
    shortString: 255,     // للحقول القصيرة مثل الاسم
    longText: 50000,      // 50KB للنصوص الطويلة مثل الوصف
    email: 320,           // الحد الأقصى RFC للبريد
    url: 2048,            // الحد الأقصى لـ URL
    phone: 20,            // رقم الهاتف
    array: 100,           // عدد عناصر المصفوفة
    objectKeys: 50,       // عدد مفاتيح الكائن
    nestedDepth: 10,      // عمق التداخل
  };

  // حقول لها حدود خاصة
  private readonly FIELD_LIMITS: Record<string, number> = {
    email: 320,
    username: 50,
    name: 100,
    firstname: 50,
    lastname: 50,
    phone: 20,
    mobile: 20,
    password: 128,
    title: 200,
    slug: 100,
    description: 5000,
    bio: 2000,
    content: 50000,
    address: 500,
    city: 100,
    country: 100,
    zipcode: 20,
    postalcode: 20,
    url: 2048,
    website: 2048,
    link: 2048,
  };

  constructor(private readonly customLimits?: Record<string, number>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (value === null || value === undefined) {
      return value;
    }

    this.validateValue(value, metadata.data || 'input', 0);
    return value;
  }

  /**
   * التحقق من القيمة بشكل متكرر
   */
  private validateValue(
    value: any,
    fieldName: string,
    depth: number,
  ): void {
    // منع التداخل العميق
    if (depth > this.DEFAULT_LIMITS.nestedDepth) {
      throw new BadRequestException(
        `Input nesting too deep at "${fieldName}"`,
      );
    }

    if (typeof value === 'string') {
      this.validateString(value, fieldName);
    } else if (Array.isArray(value)) {
      this.validateArray(value, fieldName, depth);
    } else if (typeof value === 'object' && value !== null) {
      this.validateObject(value, fieldName, depth);
    }
  }

  /**
   * التحقق من طول النص
   */
  private validateString(value: string, fieldName: string): void {
    const normalizedField = fieldName.toLowerCase().replace(/[_-]/g, '');
    
    // البحث عن حد مخصص
    const customLimit = this.customLimits?.[normalizedField];
    if (customLimit !== undefined) {
      if (value.length > customLimit) {
        throw new BadRequestException(
          `Field "${fieldName}" exceeds maximum length of ${customLimit} characters`,
        );
      }
      return;
    }

    // البحث عن حد مُعرّف مسبقاً
    const predefinedLimit = this.FIELD_LIMITS[normalizedField];
    if (predefinedLimit !== undefined) {
      if (value.length > predefinedLimit) {
        throw new BadRequestException(
          `Field "${fieldName}" exceeds maximum length of ${predefinedLimit} characters`,
        );
      }
      return;
    }

    // استخدام الحد الافتراضي للنصوص
    if (value.length > this.DEFAULT_LIMITS.string) {
      throw new BadRequestException(
        `Field "${fieldName}" exceeds maximum length of ${this.DEFAULT_LIMITS.string} characters`,
      );
    }
  }

  /**
   * التحقق من المصفوفة
   */
  private validateArray(
    value: any[],
    fieldName: string,
    depth: number,
  ): void {
    if (value.length > this.DEFAULT_LIMITS.array) {
      throw new BadRequestException(
        `Array "${fieldName}" exceeds maximum of ${this.DEFAULT_LIMITS.array} items`,
      );
    }

    value.forEach((item, index) => {
      this.validateValue(item, `${fieldName}[${index}]`, depth + 1);
    });
  }

  /**
   * التحقق من الكائن
   */
  private validateObject(
    value: Record<string, any>,
    fieldName: string,
    depth: number,
  ): void {
    const keys = Object.keys(value);

    if (keys.length > this.DEFAULT_LIMITS.objectKeys) {
      throw new BadRequestException(
        `Object "${fieldName}" exceeds maximum of ${this.DEFAULT_LIMITS.objectKeys} keys`,
      );
    }

    keys.forEach((key) => {
      // التحقق من طول اسم المفتاح
      if (key.length > 100) {
        throw new BadRequestException(
          `Object key "${key.substring(0, 20)}..." exceeds maximum length`,
        );
      }

      this.validateValue(value[key], `${fieldName}.${key}`, depth + 1);
    });
  }
}

/**
 * Factory function لإنشاء pipe بحدود مخصصة
 */
export function createInputLengthPipe(
  customLimits: Record<string, number>,
): InputLengthPipe {
  return new InputLengthPipe(customLimits);
}
