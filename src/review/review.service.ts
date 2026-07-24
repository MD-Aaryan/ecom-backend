import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, productId: number, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const hasOrdered = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: 'DELIVERED' } },
    });
    if (!hasOrdered)
      throw new ForbiddenException(
        'Only customers with a delivered order can review',
      );

    const existing = await this.prisma.review.findFirst({
      where: { userId, productId },
    });
    if (existing)
      throw new ForbiddenException('You have already reviewed this product');

    return this.prisma.review.create({ data: { ...dto, userId, productId } });
  }

  async getProductReviews(productId: number, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async update(userId: number, reviewId: number, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('You can only edit your own review');

    return this.prisma.review.update({ where: { id: reviewId }, data: dto });
  }

  async delete(userId: number, reviewId: number, userRole: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to delete this review');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Review deleted' };
  }
}
