import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getStats() {
    const cached = await this.cache.get<{
      activeUsers: number;
      activeProducts: number;
      totalOrders: number;
      revenue: number;
    }>('admin:stats');
    if (cached) return cached;

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

    const result = {
      activeUsers,
      activeProducts,
      totalOrders,
      revenue: revenue._sum.total ?? 0,
    };
    await this.cache.set('admin:stats', result, 120);
    return result;
  }

  async getRevenueData(interval: string) {
    const trunc =
      interval === 'week' ? 'week' : interval === 'month' ? 'month' : 'day';
    const cacheKey = `admin:revenue:${trunc}`;
    const cached =
      await this.cache.get<{ date: string; revenue: number }[]>(cacheKey);
    if (cached) return cached;

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
    const result = rows.map((r) => ({
      date: r.date.slice(0, 10),
      revenue: Number(r.revenue),
    }));
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getTopProducts() {
    const cached = await this.cache.get<
      {
        product: { id: string; title: string } | null;
        totalSold: number | null;
      }[]
    >('admin:topProducts');
    if (cached) return cached;

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
    const result = items.map((i) => ({
      product: productMap.get(i.productId) ?? null,
      totalSold: i._sum.quantity,
    }));
    await this.cache.set('admin:topProducts', result, 120);
    return result;
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
