import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { getPaginationParams, paginateMeta } from '../common/helpers/pagination.helper';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateContactDto) {
    return this.prisma.contact.create({ data: dto });
  }

  async findAll(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async findOne(id: string) {
    return this.prisma.contact.findUnique({ where: { id } });
  }

  async remove(id: string) {
    const record = await this.prisma.contact.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Contact message not found');
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }
}