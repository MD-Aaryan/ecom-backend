import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateSubcategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;
}
