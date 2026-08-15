import { IsEmail, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class RegisterDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsStrongPassword()
  password: string;
}
