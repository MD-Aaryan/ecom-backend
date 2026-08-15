import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getWishlist(@CurrentUser('userId') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Post('add/:productId')
  @UseGuards(JwtAuthGuard)
  add(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.wishlistService.addToWishlist(userId, productId);
  }

  @Delete('remove/:productId')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.wishlistService.removeFromWishlist(userId, productId);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  clear(@CurrentUser('userId') userId: string) {
    return this.wishlistService.clearWishlist(userId);
  }
}
