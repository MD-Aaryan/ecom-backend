import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  getWishlist(userId: number) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
    });
  }

  async addToWishlist(userId: number, productId: number) {
    const existing = await this.prisma.wishlistItem.findFirst({
      where: { userId, productId },
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    return this.prisma.wishlistItem.create({ data: { userId, productId } });
  }

  async removeFromWishlist(userId: number, productId: number) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { message: 'Removed from wishlist' };
  }

  async clearWishlist(userId: number) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });
    return { message: 'Wishlist cleared' };
  }
}
