import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getCart(@CurrentUser('userId') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('add')
  @UseGuards(JwtAuthGuard)
  add(@Body() dto: AddToCartDto, @CurrentUser('userId') userId: string) {
    return this.cartService.addToCart(userId, dto);
  }

  @Patch('item/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.cartService.updateQuantity(userId, id, dto);
  }

  @Delete('item/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.cartService.removeItem(userId, id);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  clear(@CurrentUser('userId') userId: string) {
    return this.cartService.clearCart(userId);
  }
}
