import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority } from '@prisma/client';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  createTicket(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({ data: { ...dto, userId } });
  }

  async getUserTickets(userId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: { replies: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.supportTicket.count({ where: { userId } }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async getTicketDetails(ticketId: string, userId: string, userRole: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        replies: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && userRole !== 'ADMIN')
      throw new ForbiddenException('Not your ticket');
    return ticket;
  }

  async replyToTicket(
    ticketId: string,
    userId: string,
    dto: ReplyTicketDto,
    isAdmin: boolean,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && !isAdmin)
      throw new ForbiddenException('Not your ticket');

    const reply = await this.prisma.ticketReply.create({
      data: { ticketId, userId, message: dto.message, isAdmin },
    });

    if (isAdmin && ticket.status === 'OPEN') {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return reply;
  }

  async closeTicket(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId)
      throw new ForbiddenException('Not your ticket');

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });
  }

  async getAllTickets(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          replies: true,
        },
      }),
      this.prisma.supportTicket.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async assignTicket(ticketId: string, adminId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedTo: adminId },
    });
  }

  async updatePriority(ticketId: string, priority: TicketPriority) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });
  }
}
