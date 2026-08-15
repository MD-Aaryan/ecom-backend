import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadedFile } from '../common/types/uploaded-file.type';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private cloudinary: CloudinaryService,
  ) {}

  async create(
    userId: string,
    productId: string,
    dto: CreateReviewDto,
    file?: UploadedFile,
  ) {
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

    let image: string | undefined;
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'reviews');
      image = result.url;
    }

    const review = await this.prisma.review.create({
      data: { ...dto, image, userId, productId },
    });
    await this.cache.del(`product:${productId}`);
    return review;
  }

  async getProductReviews(productId: string, page?: number, limit?: number) {
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

  async update(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    file?: UploadedFile,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('You can only edit your own review');

    let image: string | undefined;
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'reviews');
      image = result.url;
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: image ? { ...dto, image } : dto,
    });
    await this.cache.del(`product:${review.productId}`);
    return updated;
  }

  async delete(userId: string, reviewId: string, userRole: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to delete this review');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.cache.del(`product:${review.productId}`);
    return { message: 'Review deleted' };
  }
}
