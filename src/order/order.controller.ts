import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  placeOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.orderService.placeOrder(req.user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getUserOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.getUserOrders(
      req.user.userId,
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
  track(@Param('orderId') orderId: string, @Req() req: any) {
    return this.orderService.trackOrder(+orderId, req.user.userId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.orderService.cancelOrder(+id, req.user.userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateOrderStatus(+id, dto);
  }
}
