import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private async getCartForUser(userId: string) {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  private async ensureCart(userId: string) {
    let cart = await this.getCartForUser(userId);
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }
    return cart;
  }

  async getCart(userId: string) {
    return this.ensureCart(userId);
  }

  async addToCart(userId: string, dto: AddToCartDto) {
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

    const cart = await this.ensureCart(userId);
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
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId)
      throw new NotFoundException('Cart item not found');

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

  async removeItem(userId: string, cartItemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId)
      throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: cartItemId } });
    return { message: 'Item removed from cart' };
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { message: 'Cart cleared' };
  }
}
