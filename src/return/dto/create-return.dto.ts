import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReturnDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
