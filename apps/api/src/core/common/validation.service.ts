import { Injectable, BadRequestException } from '@nestjs/common';

export interface ValidationRule {
  type:
    | 'required'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'pattern'
    | 'email'
    | 'phone'
    | 'url'
    | 'date'
    | 'custom';
  value?: any;
  message?: string;
}

export interface FieldValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  phone?: boolean;
  url?: boolean;
  customMessage?: string;
}

@Injectable()
export class ValidationService {
  /**
   * Validate a single field value against its validation rules
   */
  validateField(
    fieldLabel: string,
    fieldType: string,
    value: any,
    rules: FieldValidationRules,
    required: boolean = false,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required
    if (required && this.isEmpty(value)) {
      errors.push(rules.customMessage || `حقل "${fieldLabel}" إلزامي`);
      return { isValid: false, errors };
    }

    // If field is empty and not required, skip other validations
    if (this.isEmpty(value)) {
      return { isValid: true, errors: [] };
    }

    // Text validations
    if (fieldType === 'TEXT' || fieldType === 'TEXTAREA') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(
          `يجب أن يحتوي "${fieldLabel}" على ${rules.minLength} حرف على الأقل`,
        );
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`يجب ألا يتجاوز "${fieldLabel}" ${rules.maxLength} حرف`);
      }
    }

    // Number validations
    if (fieldType === 'NUMBER') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push(`"${fieldLabel}" يجب أن يكون رقماً صحيحاً`);
      } else {
        if (rules.min !== undefined && numValue < rules.min) {
          errors.push(`يجب ألا يقل "${fieldLabel}" عن ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          errors.push(`يجب ألا يزيد "${fieldLabel}" عن ${rules.max}`);
        }
      }
    }

    // Email validation
    if (fieldType === 'EMAIL' || rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`يرجى إدخال بريد إلكتروني صحيح في "${fieldLabel}"`);
      }
    }

    // Phone validation
    if (fieldType === 'PHONE' || rules.phone) {
      const phoneRegex =
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(value)) {
        errors.push(`يرجى إدخال رقم هاتف صحيح في "${fieldLabel}"`);
      }
    }

    // URL validation
    if (rules.url) {
      try {
        new URL(value);
      } catch {
        errors.push(`يرجى إدخال رابط صحيح في "${fieldLabel}"`);
      }
    }

    // Pattern validation (Regex)
    if (rules.pattern) {
      try {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          errors.push(
            rules.customMessage ||
              `قيمة "${fieldLabel}" غير متطابقة مع الصيغة المطلوبة`,
          );
        }
      } catch (error) {
        console.error('Invalid regex pattern:', rules.pattern);
      }
    }

    // Date validations
    if (fieldType === 'DATE' || fieldType === 'DATETIME') {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        errors.push(`"${fieldLabel}" يجب أن يكون تاريخاً صحيحاً`);
      } else {
        if (rules.min) {
          const minDate = new Date(rules.min);
          if (dateValue < minDate) {
            errors.push(
              `يجب ألا يسبق "${fieldLabel}" تاريخ ${minDate.toLocaleDateString('iq-en')}`,
            );
          }
        }
        if (rules.max) {
          const maxDate = new Date(rules.max);
          if (dateValue > maxDate) {
            errors.push(
              `يجب ألا يتجاوز "${fieldLabel}" تاريخ ${maxDate.toLocaleDateString('iq-en')}`,
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate all form fields
   */
  validateFormSubmission(
    fields: Array<{
      id?: string;
      label: string;
      type: string;
      required: boolean;
      validationRules?: any;
    }>,
    submissionData: Record<string, any>,
  ): { isValid: boolean; errors: Record<string, string[]> } {
    const errors: Record<string, string[]> = {};

    fields.forEach((field) => {
      const fieldId = field.id || field.label;
      const value = submissionData[fieldId];
      const rules = this.parseValidationRules(field.validationRules);

      const validation = this.validateField(
        field.label,
        field.type,
        value,
        rules,
        field.required,
      );

      if (!validation.isValid) {
        errors[fieldId] = validation.errors;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Parse validation rules from JSON or object
   */
  private parseValidationRules(rules: any): FieldValidationRules {
    if (!rules) return {};

    if (typeof rules === 'string') {
      try {
        return JSON.parse(rules);
      } catch {
        return {};
      }
    }

    return rules;
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  /**
   * Get validation error messages in a flat format
   */
  flattenErrors(errors: Record<string, string[]>): string[] {
    const allErrors: string[] = [];
    Object.values(errors).forEach((fieldErrors) => {
      allErrors.push(...fieldErrors);
    });
    return allErrors;
  }
}
