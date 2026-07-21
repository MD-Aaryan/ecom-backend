import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditLogService.getAuditLogs(
      page ? +page : undefined,
      limit ? +limit : undefined,
      entity,
      userId ? +userId : undefined,
    );
  }
}
