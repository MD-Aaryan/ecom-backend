import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { MailService } from '../notifications/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private mailService: MailService,
    private auditLog: AuditLogService,
  ) {}

  async placeOrder(userId: string, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const order = await this.prisma.$transaction(async (tx) => {
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

      let subtotal = 0;
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
          subtotal += price * item.quantity;

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
        if (subtotal < coupon.minOrderAmount)
          throw new BadRequestException('Minimum order amount not met');

        discount =
          coupon.discountType === 'PERCENTAGE'
            ? (subtotal * coupon.discountValue) / 100
            : coupon.discountValue;
        if (coupon.maxDiscount)
          discount = Math.min(discount, coupon.maxDiscount);
        discount = Math.min(discount, subtotal);
        couponId = coupon.id;
        const used = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0)
          throw new BadRequestException('Coupon usage limit reached');
      }

      // Shipping calculation (matching frontend)
      const setting = await this.prisma.siteSetting.findUnique({
        where: { id: 'site' },
      });
      const FREE_SHIPPING_THRESHOLD =
        setting?.freeShippingThreshold ?? 150;
      const STANDARD_SHIPPING = setting?.standardShippingFee ?? 12;
      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
      const total = Math.max(0, subtotal + shipping - discount);

      const order = await tx.order.create({
        data: {
          userId,
          total,
          subtotal,
          discount,
          shipping,
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
          payment: {
            create: {
              method: 'COD',
              status: 'PENDING',
              paidAt: null,
            },
          },
          statusLog: { create: { status: 'PENDING' } },
        },
        include: { items: { include: { product: true } }, payment: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      await this.auditLog.logAction('CREATE', 'Order', order.id, userId, null, {
        total: order.total,
        status: order.status,
      });

      return order;
    });

    if (user?.email) {
      await this.mailService
        .sendOrderConfirmation(user.email, user.name, {
          orderId: order.id,
          status: order.status,
          total: order.total,
          subtotal: order.subtotal,
          discount: order.discount,
          shipping: order.shipping,
          address: order.address,
          items: order.items.map((i) => ({
            name: i.product?.title ?? 'Product',
            quantity: i.quantity,
            price: i.price,
          })),
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send order confirmation to ${user.email}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    return order;
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
      include: {
        items: { include: { product: true } },
        statusLog: { orderBy: { createdAt: 'asc' } },
      },
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
      await this.auditLog.logAction('CANCEL', 'Order', orderId, userId, { status: order.status }, { status: 'CANCELLED' });
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
          statusLog: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.order.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const oldStatus = order.status;
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          courierName: dto.courierName,
          courierAwb: dto.courierAwb,
          statusLog: { create: { status: dto.status, note: dto.note } },
          ...(dto.status === 'DELIVERED'
            ? {
                payment: {
                  update: { status: 'PAID', paidAt: new Date() },
                },
              }
            : {}),
        },
        include: {
          items: { include: { product: true } },
          payment: true,
        },
      });

      await this.notificationService.createForUser(
        order.userId,
        `Your order is now ${dto.status}`,
      );

      await this.auditLog.logAction('UPDATE', 'Order', orderId, adminId, { status: oldStatus }, { status: dto.status });

      return updated;
    });

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
    });
    if (user?.email) {
      await this.mailService
        .sendOrderStatusUpdate(user.email, user.name, {
          orderId: updated.id,
          status: updated.status,
          total: updated.total,
          subtotal: updated.subtotal,
          discount: updated.discount,
          shipping: updated.shipping,
          address: updated.address,
          courierName: updated.courierName,
          courierAwb: updated.courierAwb,
          items: updated.items.map((i) => ({
            name: i.product?.title ?? 'Product',
            quantity: i.quantity,
            price: i.price,
          })),
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send status update to ${user.email}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    return updated;
  }

  async removeOrder(orderId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      await tx.statusLog.deleteMany({ where: { orderId } });
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.returnRequest.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });

      await this.auditLog.logAction('DELETE', 'Order', orderId, adminId, null, {
        status: order.status,
        total: order.total,
      });
      return { success: true };
    });
  }
}
