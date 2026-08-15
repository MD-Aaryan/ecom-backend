import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('revenue')
  getRevenue(@Query('interval') interval: string) {
    return this.adminService.getRevenueData(interval ?? 'day');
  }

  @Get('top-products')
  getTopProducts() {
    return this.adminService.getTopProducts();
  }

  @Get('recent-orders')
  getRecentOrders() {
    return this.adminService.getRecentOrders();
  }

  @Get('low-stock')
  getLowStock() {
    return this.adminService.getLowStockProducts();
  }
}
