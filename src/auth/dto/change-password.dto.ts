import { IsString, Length, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class ChangePasswordDto {
  @IsString()
  @Length(6, 6)
  otp: string;

  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
