import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  placeOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.orderService.placeOrder(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getUserOrders(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.getUserOrders(
      userId,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.orderService.getAllOrders(
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get('track/:orderId')
  @UseGuards(JwtAuthGuard)
  track(
    @Param('orderId') orderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.orderService.trackOrder(orderId, userId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.orderService.cancelOrder(id, userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateOrderStatus(id, dto);
  }
}
