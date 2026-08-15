import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class SendChangeOtpDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
