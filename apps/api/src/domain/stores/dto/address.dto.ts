import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsLatitude,
  IsLongitude,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// المحافظات العراقية
export enum IraqiGovernorate {
  BAGHDAD = 'بغداد',
  BASRA = 'البصرة',
  NINEVEH = 'نينوى',
  ERBIL = 'أربيل',
  SULAYMANIYAH = 'السليمانية',
  DUHOK = 'دهوك',
  KIRKUK = 'كركوك',
  DIYALA = 'ديالى',
  ANBAR = 'الأنبار',
  BABYLON = 'بابل',
  KARBALA = 'كربلاء',
  NAJAF = 'النجف',
  QADISIYYAH = 'القادسية',
  MUTHANNA = 'المثنى',
  DHI_QAR = 'ذي قار',
  MAYSAN = 'ميسان',
  WASIT = 'واسط',
  SALADIN = 'صلاح الدين',
}

export class CreateAddressDto {
  @ApiProperty({ description: 'تسمية العنوان', example: 'المنزل' })
  @IsString()
  @MinLength(2, { message: 'التسمية يجب أن تكون حرفين على الأقل' })
  @MaxLength(50)
  label: string;

  @ApiProperty({ description: 'اسم المستلم الكامل' })
  @IsString()
  @MinLength(3, { message: 'الاسم يجب أن يكون 3 أحرف على الأقل' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ description: 'رقم الهاتف العراقي', example: '07701234567' })
  @IsString()
  @Matches(/^07[3-9][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون عراقي صحيح (مثال: 07701234567)',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'الدولة', default: 'العراق' })
  @IsOptional()
  @IsString()
  country?: string = 'العراق';

  @ApiProperty({ description: 'المحافظة', example: 'بغداد' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ description: 'المنطقة/الحي', example: 'الكرادة' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: 'العنوان التفصيلي/الشارع' })
  @IsString()
  @MinLength(5, { message: 'العنوان يجب أن يكون 5 أحرف على الأقل' })
  street: string;

  @ApiPropertyOptional({ description: 'رقم المبنى/الدار' })
  @IsOptional()
  @IsString()
  buildingNo?: string;

  @ApiPropertyOptional({ description: 'الطابق' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ description: 'رقم الشقة' })
  @IsOptional()
  @IsString()
  apartmentNo?: string;

  @ApiPropertyOptional({
    description: 'أقرب نقطة دالة',
    example: 'قرب جامع الرحمن',
  })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({ description: 'خط العرض (GPS)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'خط الطول (GPS)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'تعيين كعنوان افتراضي', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'تسمية العنوان' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional({ description: 'اسم المستلم الكامل' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: 'رقم الهاتف العراقي' })
  @IsOptional()
  @IsString()
  @Matches(/^07[3-9][0-9]{8}$/, {
    message: 'رقم الهاتف يجب أن يكون عراقي صحيح',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'المحافظة' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'المنطقة/الحي' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'العنوان التفصيلي/الشارع' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  street?: string;

  @ApiPropertyOptional({ description: 'رقم المبنى/الدار' })
  @IsOptional()
  @IsString()
  buildingNo?: string;

  @ApiPropertyOptional({ description: 'الطابق' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ description: 'رقم الشقة' })
  @IsOptional()
  @IsString()
  apartmentNo?: string;

  @ApiPropertyOptional({ description: 'أقرب نقطة دالة' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({ description: 'خط العرض (GPS)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'خط الطول (GPS)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;
}

export class UpdateLocationDto {
  @ApiProperty({ description: 'خط العرض (GPS)' })
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty({ description: 'خط الطول (GPS)' })
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({ description: 'العنوان المستخرج من الخريطة' })
  @IsOptional()
  @IsString()
  formattedAddress?: string;
}

// المحافظات العراقية مع معلومات إضافية
export const IRAQI_GOVERNORATES = [
  { name: 'بغداد', nameEn: 'Baghdad', lat: 33.3152, lng: 44.3661 },
  { name: 'البصرة', nameEn: 'Basra', lat: 30.5085, lng: 47.7804 },
  { name: 'نينوى', nameEn: 'Nineveh', lat: 36.335, lng: 43.1189 },
  { name: 'أربيل', nameEn: 'Erbil', lat: 36.1901, lng: 44.0091 },
  { name: 'السليمانية', nameEn: 'Sulaymaniyah', lat: 35.5614, lng: 45.4306 },
  { name: 'دهوك', nameEn: 'Duhok', lat: 36.8669, lng: 42.9503 },
  { name: 'كركوك', nameEn: 'Kirkuk', lat: 35.4681, lng: 44.3922 },
  { name: 'ديالى', nameEn: 'Diyala', lat: 33.7733, lng: 45.1497 },
  { name: 'الأنبار', nameEn: 'Anbar', lat: 33.4259, lng: 43.2994 },
  { name: 'بابل', nameEn: 'Babylon', lat: 32.4683, lng: 44.4203 },
  { name: 'كربلاء', nameEn: 'Karbala', lat: 32.616, lng: 44.0249 },
  { name: 'النجف', nameEn: 'Najaf', lat: 31.9965, lng: 44.3148 },
  { name: 'القادسية', nameEn: 'Qadisiyyah', lat: 31.9889, lng: 44.9267 },
  { name: 'المثنى', nameEn: 'Muthanna', lat: 29.9306, lng: 45.2933 },
  { name: 'ذي قار', nameEn: 'Dhi Qar', lat: 31.0439, lng: 46.2572 },
  { name: 'ميسان', nameEn: 'Maysan', lat: 31.8389, lng: 47.1456 },
  { name: 'واسط', nameEn: 'Wasit', lat: 32.5, lng: 45.8333 },
  { name: 'صلاح الدين', nameEn: 'Saladin', lat: 34.4667, lng: 43.5833 },
];
