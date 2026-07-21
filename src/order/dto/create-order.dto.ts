import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

enum PaymentMethod {
  COD = 'COD',
  ONLINE = 'ONLINE',
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
