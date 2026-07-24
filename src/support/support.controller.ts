import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, TicketPriority } from '@prisma/client';

@Controller()
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('support/tickets')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTicketDto, @Req() req: any) {
    return this.supportService.createTicket(req.user.userId, dto);
  }

  @Get('support/tickets')
  @UseGuards(JwtAuthGuard)
  getUserTickets(@Req() req: any) {
    return this.supportService.getUserTickets(req.user.userId);
  }

  @Get('support/tickets/:id')
  @UseGuards(JwtAuthGuard)
  getTicket(@Param('id') id: string, @Req() req: any) {
    return this.supportService.getTicketDetails(
      +id,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('support/tickets/:id/reply')
  @UseGuards(JwtAuthGuard)
  reply(@Param('id') id: string, @Body() dto: ReplyTicketDto, @Req() req: any) {
    return this.supportService.replyToTicket(
      +id,
      req.user.userId,
      dto,
      req.user.role === 'ADMIN',
    );
  }

  @Patch('support/tickets/:id/status')
  @UseGuards(JwtAuthGuard)
  close(@Param('id') id: string, @Req() req: any) {
    return this.supportService.closeTicket(+id, req.user.userId);
  }

  @Get('admin/support/tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllTickets() {
    return this.supportService.getAllTickets();
  }

  @Patch('admin/support/tickets/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  assign(@Param('id') id: string, @Req() req: any) {
    return this.supportService.assignTicket(+id, req.user.userId);
  }

  @Patch('admin/support/tickets/:id/priority')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updatePriority(
    @Param('id') id: string,
    @Body('priority') priority: TicketPriority,
  ) {
    return this.supportService.updatePriority(+id, priority);
  }
}
