import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookProcessor } from './webhook.processor';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, WebhookProcessor, PrismaService],
})
export class WebhookModule {}
