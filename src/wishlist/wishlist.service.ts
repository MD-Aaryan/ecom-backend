import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  getWishlist(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
    });
  }

  async addToWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || !product.isActive)
      throw new NotFoundException('Product not found');

    const existing = await this.prisma.wishlistItem.findFirst({
      where: { userId, productId },
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    return this.prisma.wishlistItem.create({ data: { userId, productId } });
  }

  async removeFromWishlist(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { message: 'Removed from wishlist' };
  }

  async clearWishlist(userId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });
    return { message: 'Wishlist cleared' };
  }
}
