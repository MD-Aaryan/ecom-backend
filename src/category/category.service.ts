import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Category name already exists');

    return this.prisma.category.create({ data: dto });
  }

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      include: { subcategories: { where: { isActive: true } } },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { subcategories: { where: { isActive: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async softDelete(id: number) {
    await this.findOne(id);
    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    // ponytail: cascade to subcategories inline, would use Prisma cascade in production
    await this.prisma.subcategory.updateMany({
      where: { categoryId: id },
      data: { isActive: false },
    });
    return { message: 'Category deleted successfully' };
  }
}
