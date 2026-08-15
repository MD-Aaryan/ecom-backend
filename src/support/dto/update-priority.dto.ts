import { IsEnum } from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class UpdatePriorityDto {
  @IsEnum(TicketPriority)
  priority: TicketPriority;
}
