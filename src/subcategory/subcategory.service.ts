import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Injectable()
export class SubcategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSubcategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || !category.isActive)
      throw new BadRequestException('Parent category not found or inactive');

    return this.prisma.subcategory.create({ data: dto });
  }

  findAll(categoryId?: string) {
    const where: Prisma.SubcategoryWhereInput = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.subcategory.findMany({
      where,
      include: { category: true },
    });
  }

  async findOne(id: string) {
    const sub = await this.prisma.subcategory.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!sub) throw new NotFoundException('Subcategory not found');
    return sub;
  }

  async update(id: string, dto: UpdateSubcategoryDto) {
    await this.findOne(id);
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || !category.isActive)
        throw new BadRequestException('Parent category not found or inactive');
    }
    return this.prisma.subcategory.update({ where: { id }, data: dto });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.subcategory.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Subcategory deleted successfully' };
  }
}
