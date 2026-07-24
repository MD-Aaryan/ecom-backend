import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getWishlist(@Req() req: any) {
    return this.wishlistService.getWishlist(req.user.userId);
  }

  @Post('add/:productId')
  @UseGuards(JwtAuthGuard)
  add(@Param('productId') productId: string, @Req() req: any) {
    return this.wishlistService.addToWishlist(req.user.userId, +productId);
  }

  @Delete('remove/:productId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('productId') productId: string, @Req() req: any) {
    return this.wishlistService.removeFromWishlist(req.user.userId, +productId);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  clear(@Req() req: any) {
    return this.wishlistService.clearWishlist(req.user.userId);
  }
}
