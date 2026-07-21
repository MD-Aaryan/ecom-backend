import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  createTicket(userId: number, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({ data: { ...dto, userId } });
  }

  getUserTickets(userId: number) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getTicketDetails(ticketId: number, userId: number, userRole: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { replies: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && userRole !== 'ADMIN') throw new ForbiddenException('Not your ticket');
    return ticket;
  }

  async replyToTicket(ticketId: number, userId: number, dto: ReplyTicketDto, isAdmin: boolean) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && !isAdmin) throw new ForbiddenException('Not your ticket');

    const reply = await this.prisma.ticketReply.create({
      data: { ticketId, userId, message: dto.message, isAdmin },
    });

    if (isAdmin && ticket.status === 'OPEN') {
      await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'IN_PROGRESS' } });
    }

    return reply;
  }

  async closeTicket(ticketId: number, userId: number) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException('Not your ticket');

    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED' } });
  }

  getAllTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } }, replies: true },
    });
  }

  async assignTicket(ticketId: number, adminId: number) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedTo: adminId } });
  }

  async updatePriority(ticketId: number, priority: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
  }
}
