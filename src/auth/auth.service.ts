import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { randomInt, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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
import { SendChangeOtpDto } from './dto/send-change-otp.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private adminPasswordHash: string;
  private static readonly OTP_MAX_ATTEMPTS = 5;
  private static readonly OTP_ATTEMPT_TTL = 10 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private auditLog: AuditLogService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async onModuleInit() {
    const adminPassword = process.env.ADMIN_PASSWORD ?? '';
    if (adminPassword.length < 16) {
      throw new Error(
        'ADMIN_PASSWORD must be set and at least 16 characters long',
      );
    }
    if ((process.env.JWT_SECRET ?? '').length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    this.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      return {
        message:
          'If this email is not already registered, an OTP has been sent to verify it.',
      };
    }
    if (
      dto.email.toLowerCase() === (process.env.ADMIN_EMAIL ?? '').toLowerCase()
    )
      throw new ForbiddenException('This email cannot be registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.createOtp(dto.email, {
      name: dto.name,
      phone: dto.phone,
      passwordHash: hashedPassword,
    });

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

      const adminUser = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      const adminId = adminUser?.id ?? 0;

      const token = this.jwtService.sign(
        { sub: adminId, email: dto.email, role: 'ADMIN' },
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

    const trusted = await this.prisma.trustedDevice.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
    });
    if (trusted) return this.signTokens(user);

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

    const adminUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    const adminId = adminUser?.id ?? 0;

    const token = this.jwtService.sign(
      { sub: adminId, email: dto.email, role: 'ADMIN' },
      { expiresIn: '15m' },
    );

    return { access_token: token, role: 'ADMIN' };
  }

  private async findValidOtp(
    email: string,
    otp: string,
  ): Promise<{ id: string; data?: Prisma.InputJsonValue | null } | null> {
    const records = await this.prisma.otp.findMany({
      where: { email, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    for (const record of records) {
      if (await bcrypt.compare(otp, record.otp)) {
        return { id: record.id, data: record.data };
      }
    }
    return null;
  }

  async verifyOtp(dto: VerifyOtpDto) {
    if (await this.otpBlocked(dto.email))
      throw new ForbiddenException('Too many OTP attempts. Try again later.');
    const otpRecord = await this.findValidOtp(dto.email, dto.otp);
    if (!otpRecord) {
      await this.recordFailedOtp(dto.email);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const pending = (otpRecord.data ?? null) as {
      name?: string;
      phone?: string;
      passwordHash?: string;
    } | null;

    await this.prisma.otp.delete({ where: { id: otpRecord.id } });
    await this.clearOtpAttempts(dto.email);

    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    let welcomeCoupon: { code: string; expiresAt: Date } | undefined;

    if (!user) {
      // registration path: user is only created once OTP verifies
      if (!pending?.passwordHash)
        throw new UnauthorizedException('Invalid or expired OTP');
      user = await this.prisma.user.create({
        data: {
          name: pending.name!,
          email: dto.email,
          phone: pending.phone!,
          password: pending.passwordHash,
          isVerified: true,
        },
      });
      await this.auditLog.logAction(
        'REGISTER',
        'User',
        user.id,
        user.id,
        null,
        {
          email: dto.email,
        },
      );

      // one-time 10% welcome coupon for the new account. The code is unique
      // per user (single-use) and each new account still requires a unique
      // OTP-verified email, so no per-device gate is needed.
      const code = `WELCOME10-${user.id.slice(0, 6).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const coupon = await this.prisma.coupon.upsert({
        where: { code },
        create: {
          code,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderAmount: 0,
          usageLimit: 1,
          expiresAt,
        },
        update: {},
      });
      welcomeCoupon = { code: coupon.code, expiresAt: coupon.expiresAt };
    } else {
      if (!user.isActive)
        throw new UnauthorizedException('Invalid or expired OTP');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    await this.prisma.trustedDevice.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
      create: { userId: user.id, deviceId: dto.deviceId },
      update: {},
    });

    const tokens = await this.signTokens(user);
    return welcomeCoupon ? { ...tokens, welcomeCoupon } : tokens;
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

    const prev = await this.prisma.otp.findFirst({
      where: { email: dto.email },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.otp.deleteMany({ where: { email: dto.email } });

    await this.createOtp(
      dto.email,
      prev?.data as Prisma.InputJsonValue | undefined,
    );

    return { message: 'New OTP sent' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || user.refreshToken !== this.hashToken(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });
      const refresh_token = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: this.hashToken(refresh_token) },
      });

      return { access_token, refresh_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    // ponytail: admin tokens now sign with real admin user ID
    if (!userId) {
      return { message: 'Logged out successfully' };
    }
    await this.prisma.user.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await this.createOtp(dto.email);
    return { message: 'If an account exists, OTP sent to your email' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (await this.otpBlocked(dto.email))
      throw new ForbiddenException('Too many OTP attempts. Try again later.');
    const otpRecord = await this.findValidOtp(dto.email, dto.otp);
    if (!otpRecord) {
      await this.recordFailedOtp(dto.email);
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.prisma.otp.delete({ where: { id: otpRecord.id } });
    await this.clearOtpAttempts(dto.email);

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

    const currentOk = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!currentOk)
      throw new UnauthorizedException('Current password is incorrect');

    if (await this.otpBlocked(user.email))
      throw new ForbiddenException('Too many OTP attempts. Try again later.');
    const otpRecord = await this.findValidOtp(user.email, dto.otp);
    if (!otpRecord) {
      await this.recordFailedOtp(user.email);
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.prisma.otp.delete({ where: { id: otpRecord.id } });
    await this.clearOtpAttempts(user.email);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(dto.newPassword, 10),
        refreshToken: null,
      },
    });

    await this.mailService
      .sendPasswordChanged(user.email, user.name)
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send password-change confirmation to ${user.email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );

    return { message: 'Password changed successfully' };
  }

  async sendChangeOtp(userId: string, dto: SendChangeOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const currentOk = await bcrypt.compare(dto.currentPassword, user.password);
    if (!currentOk)
      throw new UnauthorizedException('Current password is incorrect');
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException(
        'New password must be different from the current password',
      );

    await this.createOtp(user.email);
    return { message: 'OTP sent to your email' };
  }

  private otpAttemptKey(email: string) {
    return `otp:attempts:${email}`;
  }

  private async otpBlocked(email: string): Promise<boolean> {
    const attempts = await this.cache.get<number>(this.otpAttemptKey(email));
    return (attempts ?? 0) >= AuthService.OTP_MAX_ATTEMPTS;
  }

  private async recordFailedOtp(email: string) {
    const attempts =
      (await this.cache.get<number>(this.otpAttemptKey(email))) ?? 0;
    await this.cache.set(
      this.otpAttemptKey(email),
      attempts + 1,
      AuthService.OTP_ATTEMPT_TTL,
    );
  }

  private async clearOtpAttempts(email: string) {
    await this.cache.del(this.otpAttemptKey(email));
  }

  private async signTokens(user: {
    id: string;
    name: string;
    email: string;
    role: string;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: this.hashToken(refresh_token) },
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

  private async createOtp(email: string, data?: Prisma.InputJsonValue) {
    const otp = randomInt(100000, 999999).toString();
    await this.prisma.otp.create({
      data: {
        email,
        otp: await bcrypt.hash(otp, 10),
        data,
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
