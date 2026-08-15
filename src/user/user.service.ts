import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Role } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async listUsers(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async updateRole(id: string, role: Role, adminId: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    await this.auditLog.logAction('UPDATE', 'User', id, adminId, { role: user.role }, { role });
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async softDeleteUser(id: string, adminId: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    await this.auditLog.logAction('DELETE', 'User', id, adminId, { isActive: true }, { isActive: false });
    return { message: 'User deleted successfully' };
  }

  async hardDeleteUser(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException(
        'Cannot permanently delete an admin account',
      );

    return this.prisma.$transaction(async (tx) => {
      const orderIds = (
        await tx.order.findMany({ where: { userId: id }, select: { id: true } })
      ).map((o) => o.id);

      if (orderIds.length) {
        await tx.statusLog.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.returnRequest.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      const cartIds = (
        await tx.cart.findMany({ where: { userId: id }, select: { id: true } })
      ).map((c) => c.id);

      if (cartIds.length) {
        await tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
        await tx.cart.deleteMany({ where: { id: { in: cartIds } } });
      }

      const ticketIds = (
        await tx.supportTicket.findMany({
          where: { userId: id },
          select: { id: true },
        })
      ).map((t) => t.id);

      if (ticketIds.length) {
        await tx.ticketReply.deleteMany({
          where: { ticketId: { in: ticketIds } },
        });
        await tx.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
      }

      await tx.review.deleteMany({ where: { userId: id } });
      await tx.wishlistItem.deleteMany({ where: { userId: id } });
      await tx.otp.deleteMany({ where: { email: user.email } });
      await tx.user.delete({ where: { id } });

      await this.auditLog.logAction('DELETE', 'User', id, adminId, { email: user.email, role: user.role }, null);

      return { message: 'User permanently deleted' };
    });
  }
}
