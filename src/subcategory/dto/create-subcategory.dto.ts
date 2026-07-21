import { IsNotEmpty, IsInt, IsString } from 'class-validator';

export class CreateSubcategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsInt()
  categoryId: number;
}
