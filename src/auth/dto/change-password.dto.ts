import { IsString, Length } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class ChangePasswordDto {
  @IsString()
  @Length(6, 6)
  otp: string;

  @IsStrongPassword()
  newPassword: string;
}
