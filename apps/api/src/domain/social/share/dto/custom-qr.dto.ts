import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum QRCodeFormat {
  PNG = 'png',
  SVG = 'svg',
  JPEG = 'jpeg',
}

export class CustomQRDto {
  @ApiProperty({
    description: 'URL to encode in QR code',
    example: 'https://rukny.io/@username',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'QR code output format',
    enum: QRCodeFormat,
    default: QRCodeFormat.PNG,
    required: false,
  })
  @IsEnum(QRCodeFormat)
  @IsOptional()
  format?: QRCodeFormat;

  @ApiProperty({
    description: 'QR code size in pixels',
    example: 300,
    default: 300,
    required: false,
  })
  @IsNumber()
  @Min(100)
  @Max(1000)
  @IsOptional()
  size?: number;

  @ApiProperty({
    description: 'Include logo in center',
    default: true,
    required: false,
  })
  @IsOptional()
  includeLogo?: boolean;
}
