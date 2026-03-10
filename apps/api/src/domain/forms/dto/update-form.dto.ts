import { PartialType } from '@nestjs/swagger';
import {
  CreateFormDto,
  CreateFormFieldDto,
  FormStatus,
} from './create-form.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFormDto extends PartialType(CreateFormDto) {
  @ApiPropertyOptional({ enum: FormStatus })
  @IsEnum(FormStatus)
  @IsOptional()
  status?: FormStatus;
}

export class UpdateFormFieldDto extends PartialType(CreateFormFieldDto) {}
