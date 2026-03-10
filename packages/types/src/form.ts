/**
 * Form Types
 * 
 * Shared form builder types for frontend and backend.
 */

import type { UserBase } from './user';

/**
 * Form type
 */
export interface Form {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  ownerId: string;
  owner?: UserBase;
  isPublished: boolean;
  isActive: boolean;
  fields: FormField[];
  settings?: FormSettings;
  theme?: FormTheme;
  createdAt: Date | string;
  updatedAt: Date | string;
  submissionCount: number;
}

/**
 * Form field type enum
 */
export type FormFieldType =
  // Input fields
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'SELECT'
  | 'MULTISELECT'
  | 'CHECKBOX'
  | 'RADIO'
  | 'FILE'
  | 'IMAGE'
  | 'RATING'
  | 'SCALE'
  | 'SIGNATURE'
  | 'TOGGLE'
  | 'MATRIX'
  | 'RANKING'
  // Layout blocks
  | 'HEADING'
  | 'PARAGRAPH'
  | 'DIVIDER'
  | 'TITLE'
  | 'LABEL'
  // Embed blocks
  | 'VIDEO'
  | 'AUDIO'
  | 'EMBED'
  // Advanced blocks
  | 'CONDITIONAL_LOGIC'
  | 'CALCULATED'
  | 'HIDDEN'
  | 'RECAPTCHA';

/**
 * Form field
 */
export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  order: number;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditionalLogic?: ConditionalLogic;
  metadata?: Record<string, unknown>;
}

/**
 * Field option (for select, radio, checkbox)
 */
export interface FieldOption {
  label: string;
  value: string;
  isDefault?: boolean;
}

/**
 * Field validation rules
 */
export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

/**
 * Conditional logic for field visibility
 */
export interface ConditionalLogic {
  action: 'SHOW' | 'HIDE';
  rules: ConditionalRule[];
  operator: 'AND' | 'OR';
}

/**
 * Conditional rule
 */
export interface ConditionalRule {
  fieldId: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'IS_EMPTY' | 'IS_NOT_EMPTY';
  value?: string;
}

/**
 * Form settings
 */
export interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  showProgressBar?: boolean;
  allowMultipleSubmissions?: boolean;
  notifyOnSubmission?: boolean;
  notificationEmails?: string[];
  submissionLimit?: number;
  startsAt?: Date | string;
  endsAt?: Date | string;
  requireLogin?: boolean;
  captchaEnabled?: boolean;
}

/**
 * Form theme
 */
export interface FormTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  customCss?: string;
}

/**
 * Form submission
 */
export interface FormSubmission {
  id: string;
  formId: string;
  userId?: string;
  user?: UserBase;
  data: Record<string, unknown>;
  metadata?: SubmissionMetadata;
  createdAt: Date | string;
}

/**
 * Submission metadata
 */
export interface SubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  completionTime?: number;
}

/**
 * Form statistics
 */
export interface FormStatistics {
  totalSubmissions: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  averageCompletionTime?: number;
  completionRate?: number;
  fieldDropoffs?: Record<string, number>;
}
