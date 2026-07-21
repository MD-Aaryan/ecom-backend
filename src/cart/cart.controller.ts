import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  @UseGuards(JwtAuthGuard)
  add(@Body() dto: AddToCartDto, @Req() req: any) {
    return this.cartService.addToCart(req.user.userId, dto);
  }

  @Patch('item/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCartItemDto, @Req() req: any) {
    return this.cartService.updateQuantity(req.user.userId, +id, dto);
  }

  @Delete('item/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.cartService.removeItem(req.user.userId, +id);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  clear(@Req() req: any) {
    return this.cartService.clearCart(req.user.userId);
  }
}
