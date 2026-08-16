import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface OrderItemEmail {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderEmailPayload {
  orderId: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  address: string;
  courierName?: string | null;
  courierAwb?: string | null;
  items: OrderItemEmail[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get('SMTP_PORT', 465),
        secure: true,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  private from() {
    return this.config.get('SMTP_FROM', 'noreply@ecommerce.com');
  }

  private logoUrl(): string {
    const base = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    return `${base}/logo-email.png`;
  }

  private renderLayout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2a37;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,95,110,0.12);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#0f6f7d 0%,#0a4d59 100%);padding:28px 32px;text-align:center;">
                <img src="${this.logoUrl()}" alt="Prince Aquatic" width="220" style="width:220px;height:auto;max-width:100%;border:0;display:inline-block;" />
                <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;margin-top:6px;">Prince Aquatic</div>
                <div style="font-size:13px;color:#bfe3ea;margin-top:4px;">Premium aquatics, delivered to your door</div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                ${body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#f7fbfc;border-top:1px solid #e3eef1;padding:20px 32px;text-align:center;">
                <div style="font-size:13px;color:#0f6f7d;font-weight:bold;">Prince Aquatic</div>
                <div style="font-size:12px;color:#6b7a84;margin-top:6px;">Bargachhi Marg, Biratnagar 56613 · +977 9824379630</div>
                <div style="font-size:11px;color:#9aa7ae;margin-top:8px;">This is an automated message — please do not reply to this email.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private money(value: number): string {
    return `Rs. ${value.toFixed(2)}`;
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private renderOrderSummary(payload: OrderEmailPayload): string {
    const itemRows = payload.items
      .map(
        (i) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eef2f4;font-size:13px;color:#1f2a37;">${this.esc(i.name)} × ${i.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eef2f4;font-size:13px;color:#1f2a37;text-align:right;">${this.money(i.price)}</td>
        </tr>`,
      )
      .join('');

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3eef1;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px;background-color:#f7fbfc;font-size:14px;font-weight:bold;color:#0f6f7d;">Order Summary · #${payload.orderId}</td></tr>
      <tr><td style="padding:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#8a97a0;padding-bottom:6px;">Item</th>
              <th style="text-align:right;font-size:11px;text-transform:uppercase;color:#8a97a0;padding-bottom:6px;">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#4b5a63;display:flex;justify-content:space-between;">Subtotal: <span style="float:right;">${this.money(payload.subtotal)}</span></td></tr>
      ${payload.discount > 0 ? `<tr><td style="padding:4px 16px;font-size:13px;color:#e2493b;">Discount: <span style="float:right;">- ${this.money(payload.discount)}</span></td></tr>` : ''}
      <tr><td style="padding:4px 16px;font-size:13px;color:#4b5a63;">Shipping: <span style="float:right;">${payload.shipping === 0 ? 'Free' : this.money(payload.shipping)}</span></td></tr>
      <tr><td style="padding:10px 16px 16px;font-size:15px;font-weight:bold;color:#1f2a37;border-top:1px solid #eef2f4;">Total: <span style="float:right;color:#0f6f7d;">${this.money(payload.total)}</span></td></tr>
    </table>`;
  }

  private async deliver(
    to: string,
    subject: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured — "${subject}" for ${to} not sent`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from(),
      to,
      subject,
      html: this.renderLayout(title, body),
    });
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    await this.deliver(
      email,
      'Your verification code — Prince Aquatic',
      'Your verification code',
      `<h2 style="margin:0 0 16px;font-size:20px;color:#1f2a37;">Hello 👋</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5a63;">Use the code below to verify your account. This code is valid for <strong>5 minutes</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td align="center" style="background-color:#f0f8fa;border:1px dashed #0f6f7d;border-radius:12px;padding:20px;">
          <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#0f6f7d;">${otp}</div>
        </td></tr>
      </table>
      <p style="font-size:12px;color:#8a97a0;">If you didn't request this, you can safely ignore this email.</p>`,
    );
  }

  async sendOrderConfirmation(
    email: string,
    name: string,
    payload: OrderEmailPayload,
  ): Promise<void> {
    await this.deliver(
      email,
      `Your order ${this.orderRef(payload.orderId)} is confirmed — Prince Aquatic`,
      'Order confirmed',
      `<h2 style="margin:0 0 16px;font-size:20px;color:#1f2a37;">Thanks, ${name}! 🎉</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5a63;">Your order <strong style="color:#0f6f7d;">${this.orderRef(payload.orderId)}</strong> has been placed successfully and is now being processed.</p>
      ${this.renderOrderSummary(payload)}
      <p style="font-size:13px;line-height:1.6;color:#4b5a63;margin-top:16px;">Delivering to: <strong>${this.esc(payload.address)}</strong></p>
      <p style="font-size:13px;color:#4b5a63;">We'll email you as soon as your order status changes.</p>
      <p style="font-size:12px;color:#9aa7ae;margin-top:12px;">Reference: ${payload.orderId} — quote this if you contact support.</p>`,
    );
  }

  private orderRef(id: string): string {
    return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }

  private renderStatusFlow(status: string): string {
    const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

    if (status === 'CANCELLED') {
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr><td align="center" style="background-color:#fdeceb;border:1px solid #f3c2be;border-radius:12px;padding:16px;">
          <span style="color:#c62828;font-size:14px;font-weight:bold;letter-spacing:0.5px;">This order was cancelled</span>
        </td></tr>
      </table>`;
    }

    const steps = ['PENDING', 'APPROVED', 'SHIPPED', 'DELIVERED'];
    const currentIdx = steps.indexOf(status);

    const rows = steps
      .map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const icon = done
          ? '&#10003;'
          : active
            ? '&#9679;'
            : '&#9675;';
        const circleBg = done ? '#0f6f7d' : active ? '#0f6f7d' : '#eef2f4';
        const circleBorder = active ? '3px solid #0f6f7d' : done ? '1px solid #0f6f7d' : '1px solid #cddadd';
        const textColor = active ? '#0f6f7d' : done ? '#4b5a63' : '#8a97a0';
        const fontWeight = active ? 'bold' : 'normal';
        return `<tr>
          <td style="width:36px;vertical-align:top;padding:3px 0;">
            <div style="width:26px;height:26px;line-height:24px;text-align:center;border-radius:50%;background-color:${circleBg};border:${circleBorder};color:#ffffff;font-size:13px;">${icon}</div>
          </td>
          <td style="vertical-align:middle;padding:3px 0;font-size:14px;color:${textColor};font-weight:${fontWeight};">${label(s)}</td>
        </tr>`;
      })
      .join('');

    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e3eef1;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a97a0;margin-bottom:8px;">Order status</div>
        ${rows}
      </td></tr>
    </table>`;
  }

  async sendOrderStatusUpdate(
    email: string,
    name: string,
    payload: OrderEmailPayload,
  ): Promise<void> {
    const courierLine =
      payload.courierName || payload.courierAwb
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background-color:#f7fbfc;border:1px solid #e3eef1;border-radius:12px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a97a0;margin-bottom:6px;">Courier tracking</div>
              <div style="font-size:14px;color:#1f2a37;">${this.esc(payload.courierName ?? '—')} · <strong>${this.esc(payload.courierAwb ?? '—')}</strong></div>
            </td></tr>
          </table>`
        : '';
    await this.deliver(
      email,
      `Good news — your order ${this.orderRef(payload.orderId)} is ${payload.status.toLowerCase()}`,
      'Order status update',
      `<h2 style="margin:0 0 16px;font-size:20px;color:#1f2a37;">Hi ${name},</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5a63;">Here's the latest on your order <strong style="color:#0f6f7d;">${this.orderRef(payload.orderId)}</strong>:</p>
      ${this.renderStatusFlow(payload.status)}
      ${courierLine}
      ${this.renderOrderSummary(payload)}
      <p style="font-size:12px;color:#9aa7ae;margin-top:16px;">Reference: ${payload.orderId} — quote this if you contact support.</p>`,
    );
  }

  async sendPasswordChanged(email: string, name: string): Promise<void> {
    await this.deliver(
      email,
      'Your password has been changed — Prince Aquatic',
      'Password changed',
      `<h2 style="margin:0 0 16px;font-size:20px;color:#1f2a37;">Hello ${name},</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5a63;">Your account password was changed successfully.</p>
      <p style="font-size:14px;line-height:1.6;color:#e2493b;">If this wasn't you, please contact our support team immediately at +977 9824379630.</p>`,
    );
  }
}
