import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookProcessor } from './webhook.processor';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    private processor: WebhookProcessor,
  ) {}

  async register(dto: RegisterWebhookDto) {
    return this.prisma.webhook.create({ data: dto });
  }

  findAll() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async update(id: number, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  async triggerEvent(event: string, data: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });

    for (const w of webhooks) {
      // ponytail: fire-and-forget, no await — replace with queue for production
      this.processor.dispatch(w.id, w.url, w.secret, event, data).catch(() => {});
    }
  }

  async getLogs(webhookId: number) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async testWebhook(webhookId: number) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.processor.dispatch(webhookId, webhook.url, webhook.secret, 'test', { message: 'test event' });
    return { message: 'Test event dispatched' };
  }
}
