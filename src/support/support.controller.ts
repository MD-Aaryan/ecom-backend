import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('support/tickets')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTicketDto, @CurrentUser('userId') userId: string) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get('support/tickets')
  @UseGuards(JwtAuthGuard)
  getUserTickets(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getUserTickets(
      userId,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get('support/tickets/:id')
  @UseGuards(JwtAuthGuard)
  getTicket(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.supportService.getTicketDetails(id, userId, role);
  }

  @Post('support/tickets/:id/reply')
  @UseGuards(JwtAuthGuard)
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.supportService.replyToTicket(id, userId, dto, role === 'ADMIN');
  }

  @Patch('support/tickets/:id/status')
  @UseGuards(JwtAuthGuard)
  close(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.supportService.closeTicket(id, userId);
  }

  @Get('admin/support/tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllTickets(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.supportService.getAllTickets(
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Patch('admin/support/tickets/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  assign(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.supportService.assignTicket(id, userId);
  }

  @Patch('admin/support/tickets/:id/priority')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updatePriority(@Param('id') id: string, @Body() dto: UpdatePriorityDto) {
    return this.supportService.updatePriority(id, dto.priority);
  }
}
