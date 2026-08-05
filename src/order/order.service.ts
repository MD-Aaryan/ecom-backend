import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async placeOrder(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });
      if (!cart || cart.items.length === 0)
        throw new BadRequestException('Cart is empty');

      const productIds = [...new Set(cart.items.map((i) => i.productId))];
      const variantIds = cart.items
        .filter((i) => i.variantId)
        .map((i) => i.variantId!);

      const [products, variants] = await Promise.all([
        tx.product.findMany({ where: { id: { in: productIds } } }),
        variantIds.length
          ? tx.productVariant.findMany({ where: { id: { in: variantIds } } })
          : [],
      ]);

      const productMap = new Map(
        products.map((p): [string, typeof p] => [p.id, p]),
      );
      const variantMap = new Map(
        variants.map((v): [string, typeof v] => [v.id, v]),
      );

      let total = 0;
      const itemsWithPrice: ((typeof cart.items)[0] & { price: number })[] =
        cart.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product || !product.isActive)
            throw new BadRequestException(
              `Product ${item.productId} unavailable`,
            );
          if (item.quantity > product.stock)
            throw new BadRequestException(
              `Insufficient stock for ${product.title}`,
            );

          const variant = item.variantId
            ? variantMap.get(item.variantId)
            : null;
          const price = variant?.price ?? product.price;
          total += price * item.quantity;

          return { ...item, price };
        });

      for (const item of itemsWithPrice) {
        const stockOk = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (stockOk.count === 0)
          throw new BadRequestException(
            `Insufficient stock for ${productMap.get(item.productId)?.title ?? 'product'}`,
          );
        if (item.variantId) {
          const variantOk = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (variantOk.count === 0)
            throw new BadRequestException('Insufficient variant stock');
        }
      }

      let discount = 0;
      let couponId: string | undefined;
      if (dto.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: dto.couponCode.toUpperCase() },
        });
        if (
          !coupon ||
          !coupon.isActive ||
          coupon.expiresAt < new Date() ||
          coupon.usedCount >= coupon.usageLimit
        )
          throw new BadRequestException('Invalid or expired coupon');
        if (total < coupon.minOrderAmount)
          throw new BadRequestException('Minimum order amount not met');

        discount =
          coupon.discountType === 'PERCENTAGE'
            ? (total * coupon.discountValue) / 100
            : coupon.discountValue;
        if (coupon.maxDiscount)
          discount = Math.min(discount, coupon.maxDiscount);
        discount = Math.min(discount, total);
        couponId = coupon.id;
        const used = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0)
          throw new BadRequestException('Coupon usage limit reached');
      }

      const order = await tx.order.create({
        data: {
          userId,
          total,
          discount,
          couponId,
          address: dto.address,
          phone: dto.phone,
          items: {
            create: itemsWithPrice.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
          payment: { create: { method: dto.paymentMethod, status: 'PENDING' } },
          statusLog: { create: { status: 'PENDING' } },
        },
        include: { items: true, payment: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async getUserOrders(userId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } }, payment: true },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async trackOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { statusLog: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.userId !== userId)
        throw new ForbiddenException('Not your order');
      if (!['PENDING', 'APPROVED'].includes(order.status))
        throw new BadRequestException('Order cannot be cancelled');

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          statusLog: { create: { status: 'CANCELLED' } },
        },
        include: { items: true, payment: true },
      });
      return updated;
    });
  }

  async getAllOrders(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
          payment: true,
        },
      }),
      this.prisma.order.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          courierName: dto.courierName,
          courierAwb: dto.courierAwb,
          statusLog: { create: { status: dto.status, note: dto.note } },
        },
        include: { items: true, payment: true },
      });

      // ponytail: email notification stub
      return updated;
    });
  }
}
