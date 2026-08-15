import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class ValidateCouponDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNumber()
  orderAmount: number;
}
