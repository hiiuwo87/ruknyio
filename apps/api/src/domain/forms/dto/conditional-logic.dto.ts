import {
  IsString,
  IsEnum,
  IsIn,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConditionalOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'notContains',
  GREATER_THAN = 'greaterThan',
  LESS_THAN = 'lessThan',
  GREATER_THAN_OR_EQUAL = 'greaterThanOrEqual',
  LESS_THAN_OR_EQUAL = 'lessThanOrEqual',
  IS_EMPTY = 'isEmpty',
  IS_NOT_EMPTY = 'isNotEmpty',
}

export enum ConditionalAction {
  SHOW = 'show',
  HIDE = 'hide',
  REQUIRE = 'require',
  SKIP = 'skip',
}

export class ConditionalRule {
  @ApiProperty({
    description: 'ID of the field this rule depends on',
    example: 'field-123',
  })
  @IsString()
  fieldId: string;

  @ApiProperty({
    enum: ConditionalOperator,
    description: 'Comparison operator',
  })
  @IsEnum(ConditionalOperator)
  operator: ConditionalOperator;

  @ApiPropertyOptional({
    description: 'Value to compare against (not needed for isEmpty/isNotEmpty)',
    example: 'yes',
  })
  @IsOptional()
  value?: any;

  @ApiProperty({
    enum: ConditionalAction,
    description: 'Action to perform when condition is met',
    default: ConditionalAction.SHOW,
  })
  @IsEnum(ConditionalAction)
  action: ConditionalAction = ConditionalAction.SHOW;
}

export class ConditionalLogic {
  @ApiProperty({
    description: 'Logic gate for multiple rules',
    enum: ['AND', 'OR'],
    default: 'AND',
  })
  @IsIn(['AND', 'OR'])
  logic: 'AND' | 'OR' = 'AND';

  @ApiProperty({
    type: [ConditionalRule],
    description: 'Array of conditional rules',
  })
  @ValidateNested({ each: true })
  @Type(() => ConditionalRule)
  rules: ConditionalRule[];
}
