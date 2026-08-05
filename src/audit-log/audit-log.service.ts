import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    entityId: string,
    userId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId,
        oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getAuditLogs(
    page?: number,
    limit?: number,
    entity?: string,
    userId?: string,
  ) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const where: Prisma.AuditLogWhereInput = {};
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
