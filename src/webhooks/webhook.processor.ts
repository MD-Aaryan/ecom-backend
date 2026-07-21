import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// ponytail: sync dispatch with retry — replace with Bull queue when throughput matters
@Injectable()
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private prisma: PrismaService) {}

  async dispatch(webhookId: number, url: string, secret: string | null, event: string, data: any) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (secret) {
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    let success = false;
    let status = 0;
    let responseText = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // ponytail: use native fetch instead of axios
        const res = await fetch(url, { method: 'POST', headers, body: payload });
        status = res.status;
        responseText = await res.text();
        success = status < 500;
        if (success) break;
      } catch (err: any) {
        responseText = err.message;
        status = 0;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    await this.prisma.webhookLog.create({
      data: { webhookId, event, status, response: responseText, success },
    });

    this.logger.log(`Webhook ${webhookId} event=${event} status=${status} success=${success}`);
  }
}
