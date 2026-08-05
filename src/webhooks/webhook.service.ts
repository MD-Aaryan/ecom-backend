import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhook') private webhookQueue: Queue,
  ) {}

  async register(dto: RegisterWebhookDto) {
    return this.prisma.webhook.create({ data: dto });
  }

  findAll() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  async triggerEvent(event: string, data: unknown) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });

    for (const w of webhooks) {
      await this.webhookQueue.add('dispatch', {
        webhookId: w.id,
        url: w.url,
        secret: w.secret,
        event,
        data,
      });
    }
  }

  async getLogs(webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async testWebhook(webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.webhookQueue.add('dispatch', {
      webhookId,
      url: webhook.url,
      secret: webhook.secret,
      event: 'test',
      data: { message: 'test event' },
    });
    return { message: 'Test event queued' };
  }
}
