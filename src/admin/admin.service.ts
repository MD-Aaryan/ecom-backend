import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [activeUsers, activeProducts, totalOrders, revenue] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { payment: { status: 'PAID' } } }),
    ]);
    return { activeUsers, activeProducts, totalOrders, revenue: revenue._sum.total ?? 0 };
  }

  async getRevenueData(interval: string) {
    const orders = await this.prisma.order.findMany({
      where: { payment: { status: 'PAID' } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // ponytail: simple JS grouping, would use SQL date trunc for performance
    const grouped: Record<string, number> = {};
    for (const o of orders) {
      const key = interval === 'week'
        ? `${o.createdAt.getFullYear()}-W${Math.ceil(o.createdAt.getDate() / 7)}`
        : interval === 'month'
          ? `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`
          : o.createdAt.toISOString().slice(0, 10);
      grouped[key] = (grouped[key] ?? 0) + o.total;
    }
    return Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
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

    return items.map((i) => ({
      product: products.find((p) => p.id === i.productId),
      totalSold: i._sum.quantity,
    }));
  }

  async getRecentOrders() {
    return this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } }, payment: true, items: { include: { product: { select: { title: true } } } } },
    });
  }

  async getLowStockProducts() {
    return this.prisma.product.findMany({
      where: { OR: [{ stock: { lte: 10 } }, { variants: { some: { stock: { lte: 10 } } } }] },
      include: { variants: true },
    });
  }
}
