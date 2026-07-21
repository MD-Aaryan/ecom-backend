import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Role } from '@prisma/client';
import { getPaginationParams, paginateMeta } from '../common/helpers/pagination.helper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async listUsers(page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = getPaginationParams(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { data, meta: paginateMeta(total, p, l) };
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async updateRole(id: number, role: Role) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async softDeleteUser(id: number) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'User deleted successfully' };
  }
}
