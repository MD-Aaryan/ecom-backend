import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private adminPasswordHash: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private auditLog: AuditLogService,
  ) {}

  async onModuleInit() {
    this.adminPasswordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD ?? '',
      12,
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ForbiddenException('Email already exists');
    if (
      dto.email.toLowerCase() === (process.env.ADMIN_EMAIL ?? '').toLowerCase()
    )
      throw new ForbiddenException('This email cannot be registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
      },
    });

    await this.auditLog.logAction('REGISTER', 'User', user.id, user.id, null, {
      email: dto.email,
    });

    await this.createOtp(dto.email);

    return {
      message: 'Registration successful. Please verify OTP sent to your email.',
    };
  }

  async login(dto: LoginDto) {
    if (
      dto.email.toLowerCase() === (process.env.ADMIN_EMAIL ?? '').toLowerCase()
    ) {
      const valid = await bcrypt.compare(dto.password, this.adminPasswordHash);
      if (!valid) throw new UnauthorizedException('Invalid credentials');

      const token = this.jwtService.sign(
        { sub: 0, email: dto.email, role: 'ADMIN' },
        { expiresIn: '15m' },
      );
      return { access_token: token, role: 'ADMIN' };
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.createOtp(dto.email);

    return { message: 'OTP sent to your email' };
  }

  async adminLogin(dto: AdminLoginDto) {
    if (
      dto.email.toLowerCase() !== (process.env.ADMIN_EMAIL ?? '').toLowerCase()
    ) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    const valid = await bcrypt.compare(dto.password, this.adminPasswordHash);
    if (!valid) throw new UnauthorizedException('Invalid admin credentials');

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

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refresh_token },
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const recentCount = await this.prisma.otp.count({
      where: {
        email: dto.email,
        createdAt: { gte: new Date(Date.now() - 3600000) },
      },
    });
    if (recentCount >= 3)
      throw new ForbiddenException('Too many OTP requests. Try again later.');

    await this.prisma.otp.deleteMany({ where: { email: dto.email } });

    await this.createOtp(dto.email);

    return { message: 'New OTP sent' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });

      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await this.createOtp(dto.email);
    return { message: 'If an account exists, OTP sent to your email' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const otpRecord = await this.prisma.otp.findFirst({
      where: { email: dto.email, otp: dto.otp, expiresAt: { gte: new Date() } },
    });
    if (!otpRecord) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.otp.delete({ where: { id: otpRecord.id } });

    const updated = await this.prisma.user.updateMany({
      where: { email: dto.email },
      data: {
        password: await bcrypt.hash(dto.password, 10),
        refreshToken: null,
      },
    });
    if (updated.count === 0)
      throw new UnauthorizedException('Invalid or expired OTP');

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email: user.email,
        otp: dto.otp,
        expiresAt: { gte: new Date() },
      },
    });
    if (!otpRecord) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.otp.delete({ where: { id: otpRecord.id } });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(dto.newPassword, 10),
        refreshToken: null,
      },
    });
    return { message: 'Password changed successfully' };
  }

  async sendChangeOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    await this.createOtp(user.email);
    return { message: 'OTP sent to your email' };
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
    await this.mailService
      .sendOtp(email, otp)
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send OTP to ${email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
  }
}
