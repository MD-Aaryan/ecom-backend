import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [activeUsers, activeProducts, totalOrders, revenue] =
      await Promise.all([
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.product.count({ where: { isActive: true } }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          _sum: { total: true },
          where: { payment: { status: 'PAID' } },
        }),
      ]);
    return {
      activeUsers,
      activeProducts,
      totalOrders,
      revenue: revenue._sum.total ?? 0,
    };
  }

  async getRevenueData(interval: string) {
    const trunc =
      interval === 'week' ? 'week' : interval === 'month' ? 'month' : 'day';
    const rows = await this.prisma.$queryRawUnsafe<
      { date: string; revenue: number }[]
    >(
      `SELECT DATE_TRUNC($1, o."createdAt")::text AS date, SUM(o.total) AS revenue
       FROM "Order" o INNER JOIN "Payment" p ON p."orderId" = o.id
       WHERE p.status = 'PAID'
       GROUP BY DATE_TRUNC($1, o."createdAt")
       ORDER BY date ASC`,
      trunc,
    );
    return rows.map((r) => ({
      date: r.date.slice(0, 10),
      revenue: Number(r.revenue),
    }));
  }

  async getTopProducts() {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, title: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    return items.map((i) => ({
      product: productMap.get(i.productId) ?? null,
      totalSold: i._sum.quantity,
    }));
  }

  async getRecentOrders() {
    return this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        payment: true,
        items: { include: { product: { select: { title: true } } } },
      },
    });
  }

  async getLowStockProducts() {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { stock: { lte: 10 } },
          { variants: { some: { stock: { lte: 10 } } } },
        ],
      },
      include: { variants: true },
    });
  }
}
