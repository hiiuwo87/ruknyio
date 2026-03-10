import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDate,
  IsArray,
  ValidateNested,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum FormType {
  CONTACT = 'CONTACT',
  SURVEY = 'SURVEY',
  REGISTRATION = 'REGISTRATION',
  ORDER = 'ORDER',
  FEEDBACK = 'FEEDBACK',
  QUIZ = 'QUIZ',
  APPLICATION = 'APPLICATION',
  OTHER = 'OTHER',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum FieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
  FILE = 'FILE',
  RATING = 'RATING',
  SCALE = 'SCALE',
  TOGGLE = 'TOGGLE',
  MATRIX = 'MATRIX',
  SIGNATURE = 'SIGNATURE',
  URL = 'URL',
  RANKING = 'RANKING',
  // Layout blocks
  HEADING = 'HEADING',
  PARAGRAPH = 'PARAGRAPH',
  DIVIDER = 'DIVIDER',
  TITLE = 'TITLE',
  LABEL = 'LABEL',
  // Embed blocks
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  EMBED = 'EMBED',
  // Advanced blocks
  CONDITIONAL_LOGIC = 'CONDITIONAL_LOGIC',
  CALCULATED = 'CALCULATED',
  HIDDEN = 'HIDDEN',
  RECAPTCHA = 'RECAPTCHA',
}

export class CreateFormStepDto {
  @ApiProperty({ example: 'Personal Information' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Please provide your personal details' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    example: ['field-id-1', 'field-id-2'],
    description: 'Array of field IDs assigned to this step',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fieldIds?: string[];

  @ApiPropertyOptional({
    type: () => [CreateFormFieldDto],
    description: 'Array of fields for this step (alternative to fieldIds)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormFieldDto)
  @IsOptional()
  fields?: CreateFormFieldDto[];
}

export class CreateFormFieldDto {
  @ApiPropertyOptional({
    example: 'step-uuid-here',
    description: 'ID of the step this field belongs to (for multi-step forms)',
  })
  @IsString()
  @IsOptional()
  stepId?: string;

  @ApiProperty({ example: 'What is your name?' })
  @IsString()
  @MaxLength(500)
  label: string;

  @ApiPropertyOptional({ example: 'Please enter your full name' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: FieldType })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({ example: 'Enter your answer...' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({ example: 'Default value' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  defaultValue?: string;

  @ApiPropertyOptional({
    example: ['Option 1', 'Option 2', 'Option 3'],
    description: 'Options for SELECT, RADIO, or CHECKBOX fields',
  })
  @IsOptional()
  options?: any;

  @ApiPropertyOptional({
    example: { minLength: 3, maxLength: 100, pattern: '^[a-zA-Z]+$' },
    description: 'Validation rules for the field',
  })
  @IsOptional()
  validationRules?: any;

  @ApiPropertyOptional({
    example: {
      showIf: { fieldId: 'field-1', operator: 'equals', value: 'yes' },
    },
    description: 'Conditional logic to show/hide field',
  })
  @IsOptional()
  conditionalLogic?: any;

  @ApiPropertyOptional({
    example: ['image/png', 'image/jpeg', 'application/pdf'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedFileTypes?: string[];

  @ApiPropertyOptional({
    example: 5242880,
    description: 'Max file size in bytes (5MB = 5242880)',
  })
  @IsInt()
  @IsOptional()
  maxFileSize?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxFiles?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Min value for SCALE or RATING',
  })
  @IsInt()
  @IsOptional()
  minValue?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Max value for SCALE or RATING',
  })
  @IsInt()
  @IsOptional()
  maxValue?: number;

  @ApiPropertyOptional({ example: 'Poor', description: 'Label for min value' })
  @IsString()
  @IsOptional()
  minLabel?: string;

  @ApiPropertyOptional({
    example: 'Excellent',
    description: 'Label for max value',
  })
  @IsString()
  @IsOptional()
  maxLabel?: string;

}

export class CreateFormDto {
  @ApiProperty({ example: 'Customer Feedback Form' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'customer-feedback-form' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  @MaxLength(200)
  slug: string;

  @ApiPropertyOptional({
    example: 'Help us improve our service by providing your feedback',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: FormType, example: FormType.FEEDBACK })
  @IsEnum(FormType)
  type: FormType;

  @ApiPropertyOptional({ enum: FormStatus, example: FormStatus.DRAFT })
  @IsEnum(FormStatus)
  @IsOptional()
  status?: FormStatus;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  allowMultipleSubmissions?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  requiresAuthentication?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  showProgressBar?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  showQuestionNumbers?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isMultiStep?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxSubmissions?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  submissionLimit?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  oneResponsePerUser?: boolean;

  @ApiPropertyOptional({ example: '2025-11-10T00:00:00Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  opensAt?: Date;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  closesAt?: Date;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  closeAfterDate?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  notifyOnSubmission?: boolean;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  @IsString()
  @IsOptional()
  notificationEmail?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  autoResponseEnabled?: boolean;

  @ApiPropertyOptional({ example: 'Thank you for your submission!' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  autoResponseMessage?: string;

  @ApiPropertyOptional({ example: 'event-uuid-here' })
  @IsString()
  @IsOptional()
  linkedEventId?: string;

  @ApiPropertyOptional({ example: 'store-uuid-here' })
  @IsString()
  @IsOptional()
  linkedStoreId?: string;

  @ApiPropertyOptional({
    example: { primaryColor: '#3B82F6', backgroundColor: '#FFFFFF' },
    description: 'Custom theme settings',
  })
  @IsOptional()
  theme?: any;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({
    example: [
      'https://example.com/banner1.jpg',
      'https://example.com/banner2.jpg',
    ],
    description: 'Array of banner images (base64 or URLs)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bannerImages?: string[];

  @ApiPropertyOptional({
    example: 'slider',
    description: 'Banner display mode: single or slider',
  })
  @IsString()
  @IsOptional()
  bannerDisplayMode?: 'single' | 'slider';

  @ApiPropertyOptional({ type: [CreateFormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormFieldDto)
  @IsOptional()
  fields?: CreateFormFieldDto[];

  @ApiPropertyOptional({ type: [CreateFormStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormStepDto)
  @IsOptional()
  steps?: CreateFormStepDto[];

  // ============================================
  // Integration Settings
  // ============================================

  @ApiPropertyOptional({
    example: false,
    description: 'Enable automatic Google Sheets integration for form submissions',
  })
  @IsBoolean()
  @IsOptional()
  enableGoogleSheets?: boolean;

  @ApiPropertyOptional({
    example: 's3',
    description: 'Storage provider for file uploads: s3 or google_drive',
  })
  @IsString()
  @IsOptional()
  storageProvider?: 's3' | 'google_drive';
}
