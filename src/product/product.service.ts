import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ProductQueryDto, SortBy } from './dto/product-query.dto';
import {
  getPaginationParams,
  paginateMeta,
} from '../common/helpers/pagination.helper';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateProductDto, file?: any) {
    let imageUrl = 'https://via.placeholder.com/600';
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'products');
      imageUrl = result.url;
    }

    return this.prisma.product.create({
      data: { ...dto, imageUrl },
      include: { variants: true, category: true },
    });
  }

  async searchAndFilter(query: ProductQueryDto) {
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.category) where.categoryId = query.category;
    if (query.subcategory) where.subcategoryId = query.subcategory;
    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = query.minPrice;
      if (query.maxPrice) where.price.lte = query.maxPrice;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (query.sortBy === SortBy.PRICE_ASC) orderBy.price = 'asc';
    else if (query.sortBy === SortBy.PRICE_DESC) orderBy.price = 'desc';
    else if (query.sortBy === SortBy.NEWEST) orderBy.createdAt = 'desc';
    else orderBy.createdAt = 'desc';

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { variants: true, category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: paginateMeta(total, page, limit) };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        category: true,
        reviews: { select: { rating: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const { reviews, ...rest } = product;
    const avgRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    return { ...rest, avgRating };
  }

  async update(id: number, dto: UpdateProductDto, file?: any) {
    await this.findOne(id);

    const data: any = { ...dto };
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'products');
      data.imageUrl = result.url;
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true, category: true },
    });
  }

  async softDelete(id: number) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Product deleted successfully' };
  }

  async addVariant(productId: number, dto: CreateVariantDto) {
    await this.findOne(productId);
    return this.prisma.productVariant.create({ data: { ...dto, productId } });
  }

  async updateVariant(variantId: number, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
    });
  }

  async deleteVariant(variantId: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { message: 'Variant deleted successfully' };
  }
}
