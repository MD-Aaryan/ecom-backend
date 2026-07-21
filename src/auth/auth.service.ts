import { Injectable, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ForbiddenException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
      },
    });

    await this.createOtp(dto.email);

    return { message: 'Registration successful. Please verify OTP sent to your email.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.createOtp(dto.email);

    return { message: 'OTP sent to your email' };
  }

  async adminLogin(dto: AdminLoginDto) {
    // ponytail: simple env comparison, use bcrypt hash for production
    if (dto.email !== process.env.ADMIN_EMAIL || dto.password !== process.env.ADMIN_PASSWORD) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = this.jwtService.sign(
      { sub: 0, email: dto.email, role: 'ADMIN' },
      { expiresIn: '15m' },
    );

    return { access_token: token, role: 'ADMIN' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpRecord = await this.prisma.otp.findFirst({
      where: { email: dto.email, otp: dto.otp, expiresAt: { gte: new Date() } },
    });
    if (!otpRecord) throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.otp.delete({ where: { id: otpRecord.id } });

    const user = await this.prisma.user.update({
      where: { email: dto.email },
      data: { isVerified: true },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refresh_token },
    });

    return { access_token, refresh_token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  async resendOtp(dto: ResendOtpDto) {
    // ponytail: simple rate limit — max 3 per hour
    const recentCount = await this.prisma.otp.count({
      where: { email: dto.email, createdAt: { gte: new Date(Date.now() - 3600000) } },
    });
    if (recentCount >= 3) throw new ForbiddenException('Too many OTP requests. Try again later.');

    await this.prisma.otp.deleteMany({ where: { email: dto.email } });

    await this.createOtp(dto.email);

    return { message: 'New OTP sent' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(newPayload, { expiresIn: '15m' });

      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  private async createOtp(email: string) {
    const otp = randomInt(100000, 999999).toString();
    await this.prisma.otp.create({
      data: {
        email,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    this.logger.log(`OTP for ${email}: ${otp}`);
  }
}
