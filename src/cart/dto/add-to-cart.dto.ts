import { IsInt, Min, IsOptional } from 'class-validator';

export class AddToCartDto {
  @IsInt()
  productId: number;

  @IsOptional()
  @IsInt()
  variantId?: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
