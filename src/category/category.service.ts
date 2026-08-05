import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Category name already exists');

    const category = await this.prisma.category.create({ data: dto });
    await this.cache.del('categories:all');
    return category;
  }

  async findAll() {
    const cached = await this.cache.get<
      Prisma.CategoryGetPayload<{
        include: { subcategories: { where: { isActive: boolean } } };
      }>[]
    >('categories:all');
    if (cached) return cached;

    const data = await this.prisma.category.findMany({
      where: { isActive: true },
      include: { subcategories: { where: { isActive: true } } },
    });
    await this.cache.set('categories:all', data, 300);
    return data;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { subcategories: { where: { isActive: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    await this.cache.del('categories:all');
    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await this.prisma.subcategory.updateMany({
      where: { categoryId: id },
      data: { isActive: false },
    });
    await this.cache.del('categories:all');
    return { message: 'Category deleted successfully' };
  }
}
