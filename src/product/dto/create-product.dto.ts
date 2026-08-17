import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsInt()
  stock: number;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  subcategoryId?: string;
}
