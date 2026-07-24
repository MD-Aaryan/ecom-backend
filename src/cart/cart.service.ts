import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateCart(userId: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }
    return cart;
  }

  async getCart(userId: number) {
    return this.getOrCreateCart(userId);
  }

  async addToCart(userId: number, dto: AddToCartDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive)
      throw new NotFoundException('Product not found');

    let stock = product.stock;
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (!variant) throw new NotFoundException('Variant not found');
      stock = variant.stock;
    }
    if (dto.quantity > stock)
      throw new BadRequestException('Insufficient stock');

    const cart = await this.getOrCreateCart(userId);
    const existing = cart.items.find(
      (i) =>
        i.productId === dto.productId &&
        i.variantId === (dto.variantId ?? null),
    );

    if (existing) {
      const newQty = existing.quantity + dto.quantity;
      if (newQty > stock) throw new BadRequestException('Insufficient stock');
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: dto.variantId,
        quantity: dto.quantity,
      },
    });
  }

  async updateQuantity(
    userId: number,
    cartItemId: number,
    dto: UpdateCartItemDto,
  ) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item) throw new NotFoundException('Cart item not found');

    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    let stock = product.stock;
    if (item.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
      });
      if (!variant) throw new NotFoundException('Variant not found');
      stock = variant.stock;
    }
    if (dto.quantity > stock)
      throw new BadRequestException('Insufficient stock');

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: dto.quantity },
    });
  }

  async removeItem(userId: number, cartItemId: number) {
    const cart = await this.getOrCreateCart(userId);
    if (!cart.items.find((i) => i.id === cartItemId))
      throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: cartItemId } });
    return { message: 'Item removed from cart' };
  }

  async clearCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { message: 'Cart cleared' };
  }
}
