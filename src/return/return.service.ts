import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';

@Injectable()
export class ReturnService {
  constructor(private prisma: PrismaService) {}

  async requestReturn(orderId: number, userId: number, dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Order must be delivered to request return');

    // ponytail: 7-day window uses createdAt, would use deliveredAt with a proper timestamp
    const daysSinceDelivery = Math.floor((Date.now() - order.updatedAt.getTime()) / 86400000);
    if (daysSinceDelivery > 7) throw new BadRequestException('Return window has expired (7 days)');

    const existing = await this.prisma.returnRequest.findUnique({ where: { orderId } });
    if (existing) throw new BadRequestException('Return already requested for this order');

    return this.prisma.returnRequest.create({ data: { orderId, userId, reason: dto.reason } });
  }

  getUserReturns(userId: number) {
    return this.prisma.returnRequest.findMany({
      where: { userId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getAllReturns() {
    return this.prisma.returnRequest.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReturnStatus(returnId: number, dto: UpdateReturnStatusDto) {
    const record = await this.prisma.returnRequest.findUnique({ where: { id: returnId } });
    if (!record) throw new NotFoundException('Return request not found');

    return this.prisma.returnRequest.update({
      where: { id: returnId },
      data: { status: dto.status },
    });
  }
}
