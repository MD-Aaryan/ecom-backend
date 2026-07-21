import { IsNotEmpty, IsString, IsOptional, IsNumber, IsInt } from 'class-validator';

export class CreateVariantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsInt()
  stock: number;
}
