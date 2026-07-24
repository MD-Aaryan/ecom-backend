import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(
    action: string,
    entity: string,
    entityId: number,
    userId: number,
    oldValue?: any,
    newValue?: any,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      },
    });
  }

  async getAuditLogs(
    page?: number,
    limit?: number,
    entity?: string,
    userId?: number,
  ) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const where: any = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }
}
