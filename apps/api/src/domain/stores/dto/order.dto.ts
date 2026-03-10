import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Delivery address ID' })
  @IsString()
  @IsUUID()
  addressId: string;

  @ApiPropertyOptional({ description: 'Coupon code to apply' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Customer note for the order' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

export class CreateOrderFromCartDto extends CreateOrderDto {
  // Inherits addressId, couponCode, customerNote
  // Will create order from user's cart
}

export class CreateDirectOrderDto extends CreateOrderDto {
  @ApiProperty({ description: 'Product ID to order' })
  @IsString()
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantity to order', minimum: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, description: 'New order status' })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Store note (for store owner)' })
  @IsOptional()
  @IsString()
  storeNote?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  @IsOptional()
  @Type(() => Date)
  estimatedDelivery?: Date;
}

export class CancelOrderDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  cancellationReason: string;
}

export class OrderFiltersDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Store ID (for customers viewing orders from specific store)',
  })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}
