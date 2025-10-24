import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    name: string;
    email: string;
    password: string;
    adminCode?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new ForbiddenException('Email already exists');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const role = data.adminCode === process.env.ADMIN_CODE ? 'ADMIN' : 'USER';

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role,
      },
    });

    const token = this.jwtService.sign({ sub: user.id, role: user.role });

    return { access_token: token, user };
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user) throw new ForbiddenException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(data.password, user.password);
    if (!passwordMatches) throw new ForbiddenException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id, role: user.role });

    return { access_token: token, user };
  }
}
