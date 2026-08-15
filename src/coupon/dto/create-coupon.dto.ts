import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  discountValue: number;

  @IsOptional()
  @IsNumber()
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @IsInt()
  usageLimit: number;

  @IsDateString()
  expiresAt: string;
}
