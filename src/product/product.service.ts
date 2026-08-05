import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
import { UploadedFile } from '../common/types/uploaded-file.type';

export interface ProductCache {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  categoryId: string;
  subcategoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: unknown;
  variants: unknown;
  avgRating: number | null;
}

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async create(dto: CreateProductDto, file?: UploadedFile) {
    let imageUrl = 'https://via.placeholder.com/600';
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'products');
      imageUrl = result.url;
    }

    const product = await this.prisma.product.create({
      data: { ...dto, imageUrl },
      include: { variants: true, category: true },
    });
    await this.cache.del('products:search');
    return product;
  }

  async searchAndFilter(query: ProductQueryDto) {
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );

    const conditions: string[] = ['p."isActive" = true'];
    const params: (string | number)[] = [];
    let paramIdx = 0;

    if (query.q) {
      paramIdx++;
      conditions.push(
        `to_tsvector('english', p.title || ' ' || p.description) @@ plainto_tsquery('english', $${paramIdx})`,
      );
      params.push(query.q);
    }
    if (query.category) {
      paramIdx++;
      conditions.push(`p."categoryId" = $${paramIdx}`);
      params.push(query.category);
    }
    if (query.subcategory) {
      paramIdx++;
      conditions.push(`p."subcategoryId" = $${paramIdx}`);
      params.push(query.subcategory);
    }
    if (query.minPrice) {
      paramIdx++;
      conditions.push(`p.price >= $${paramIdx}`);
      params.push(query.minPrice);
    }
    if (query.maxPrice) {
      paramIdx++;
      conditions.push(`p.price <= $${paramIdx}`);
      params.push(query.maxPrice);
    }

    const whereClause = conditions.join(' AND ');
    const orderClause =
      query.sortBy === SortBy.PRICE_ASC
        ? 'p.price ASC'
        : query.sortBy === SortBy.PRICE_DESC
          ? 'p.price DESC'
          : 'p."createdAt" DESC';

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT p.id, p.title, p.description, p.price, p."imageUrl", p.stock, p."isActive", p."createdAt", p."updatedAt", p."categoryId", p."subcategoryId", c.name AS "categoryName" FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE ${whereClause} ORDER BY ${orderClause} LIMIT $${++paramIdx} OFFSET $${++paramIdx}`,
        ...params,
        take,
        skip,
      ),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "Product" p WHERE ${whereClause}`,
        ...params,
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data: rows, meta: paginateMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const cacheKey = `product:${id}`;
    const cached = await this.cache.get<ProductCache>(cacheKey);
    if (cached) return cached;

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

    const result = { ...rest, avgRating };
    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  async update(id: string, dto: UpdateProductDto, file?: UploadedFile) {
    await this.findOne(id);

    const data: Prisma.ProductUpdateInput = { ...dto };
    if (file) {
      const result = await this.cloudinary.uploadFile(file, 'products');
      data.imageUrl = result.url;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true, category: true },
    });
    await Promise.all([
      this.cache.del(`product:${id}`),
      this.cache.del('products:search'),
    ]);
    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    await Promise.all([
      this.cache.del(`product:${id}`),
      this.cache.del('products:search'),
    ]);
    return { message: 'Product deleted successfully' };
  }

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findOne(productId);
    const variant = await this.prisma.productVariant.create({
      data: { ...dto, productId },
    });
    await this.cache.del(`product:${productId}`);
    return variant;
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
    });
    await this.cache.del(`product:${variant.productId}`);
    return updated;
  }

  async deleteVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.cache.del(`product:${variant.productId}`);
    return { message: 'Variant deleted successfully' };
  }
}
