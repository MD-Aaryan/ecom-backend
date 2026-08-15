import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyTicketDto {
  @IsNotEmpty()
  @IsString()
  message: string;
}
