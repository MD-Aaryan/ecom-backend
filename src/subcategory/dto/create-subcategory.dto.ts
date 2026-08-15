import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSubcategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsString()
  categoryId: string;
}
