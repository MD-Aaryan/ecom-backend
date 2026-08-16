import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class ReturnService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async getReturnableOrders(userId: string) {
    const delivered = await this.prisma.order.findMany({
      where: { userId, status: 'DELIVERED' },
      include: { items: { include: { product: true } }, payment: true },
      orderBy: { updatedAt: 'desc' },
    });

    const existingReturns = await this.prisma.returnRequest.findMany({
      where: { userId },
      select: { orderId: true },
    });
    const returnedIds = new Set(existingReturns.map((r) => r.orderId));

    const now = Date.now();
    return delivered
      .filter((o) => {
        if (returnedIds.has(o.id)) return false;
        const days = Math.floor((now - o.updatedAt.getTime()) / 86400000);
        return days <= 7;
      })
      .map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        items: o.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          price: i.price,
          title: i.product?.title ?? 'Product',
        })),
        payment: o.payment,
      }));
  }

  async requestReturn(
    orderId: string,
    userId: string,
    dto: CreateReturnDto,
    file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== 'DELIVERED')
      throw new BadRequestException(
        'Order must be delivered to request return',
      );

    const daysSinceDelivery = Math.floor(
      (Date.now() - order.updatedAt.getTime()) / 86400000,
    );
    if (daysSinceDelivery > 7)
      throw new BadRequestException('Return window has expired (7 days)');

    const existing = await this.prisma.returnRequest.findUnique({
      where: { orderId },
    });
    if (existing)
      throw new BadRequestException('Return already requested for this order');

    let image: string | undefined;
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'returns');
      image = result.url;
    }

    return this.prisma.returnRequest.create({
      data: { orderId, userId, reason: dto.reason, image: image ?? null },
    });
  }

  async getUserReturns(userId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where: { userId },
        skip,
        take,
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.returnRequest.count({ where: { userId } }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async getAllReturns(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.returnRequest.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async updateReturnStatus(returnId: string, dto: UpdateReturnStatusDto) {
    const record = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!record) throw new NotFoundException('Return request not found');

    return this.prisma.returnRequest.update({
      where: { id: returnId },
      data: { status: dto.status },
    });
  }

  async remove(returnId: string) {
    const record = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!record) throw new NotFoundException('Return request not found');
    await this.prisma.returnRequest.delete({ where: { id: returnId } });
    return { success: true };
  }
}
