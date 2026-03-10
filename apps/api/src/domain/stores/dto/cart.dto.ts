import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add to cart' })
  @IsString()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Quantity to add',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity', minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class RemoveFromCartDto {
  @ApiProperty({ description: 'Product ID to remove from cart' })
  @IsString()
  @IsUUID()
  productId: string;
}
