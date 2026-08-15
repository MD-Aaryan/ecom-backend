import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class CouponService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async create(dto: CreateCouponDto, userId: string) {
    const code = dto.code.toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Coupon code already exists');

    const coupon = await this.prisma.coupon.create({ data: { ...dto, code } });
    await this.auditLog.logAction('CREATE', 'Coupon', coupon.id, userId, null, { code, discountType: coupon.discountType, discountValue: coupon.discountValue });
    return coupon;
  }

  async findAll(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async update(id: string, dto: UpdateCouponDto, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const oldValue = { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, minOrderAmount: coupon.minOrderAmount, maxDiscount: coupon.maxDiscount, expiresAt: coupon.expiresAt, isActive: coupon.isActive };
    const updated = await this.prisma.coupon.update({ where: { id }, data: dto });
    await this.auditLog.logAction('UPDATE', 'Coupon', id, userId, oldValue, { code: updated.code, discountType: updated.discountType, discountValue: updated.discountValue, minOrderAmount: updated.minOrderAmount, maxDiscount: updated.maxDiscount, expiresAt: updated.expiresAt, isActive: updated.isActive });
    return updated;
  }

  async delete(id: string, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await this.prisma.coupon.delete({ where: { id } });
    await this.auditLog.logAction('DELETE', 'Coupon', id, userId, { code: coupon.code }, null);
    return { message: 'Coupon deleted' };
  }

  async validate(dto: ValidateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (
      !coupon ||
      !coupon.isActive ||
      coupon.expiresAt < new Date() ||
      coupon.usedCount >= coupon.usageLimit
    ) {
      throw new BadRequestException('Invalid or expired coupon');
    }
    if (dto.orderAmount < coupon.minOrderAmount)
      throw new BadRequestException('Minimum order amount not met');

    let discount =
      coupon.discountType === 'PERCENTAGE'
        ? (dto.orderAmount * coupon.discountValue) / 100
        : coupon.discountValue;

    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, dto.orderAmount);

    return { coupon, discount };
  }
}
