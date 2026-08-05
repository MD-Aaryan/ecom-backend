import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — OTP ${otp} for ${email} not sent`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'noreply@ecommerce.com'),
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
    });
  }

  async sendOrderConfirmation(email: string, orderId: number): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — order #${orderId} confirmation for ${email} not sent`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'noreply@ecommerce.com'),
      to: email,
      subject: `Order #${orderId} Confirmed`,
      text: `Your order #${orderId} has been placed successfully.`,
    });
  }

  async sendOrderStatusUpdate(
    email: string,
    orderId: number,
    status: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — order #${orderId} status update for ${email} not sent`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'noreply@ecommerce.com'),
      to: email,
      subject: `Order #${orderId} Update`,
      text: `Your order #${orderId} status has been updated to: ${status}.`,
    });
  }
}
