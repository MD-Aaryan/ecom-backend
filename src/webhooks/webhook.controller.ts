import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post()
  register(@Body() dto: RegisterWebhookDto) {
    return this.webhookService.register(dto);
  }

  @Get()
  findAll() {
    return this.webhookService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhookService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhookService.delete(id);
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: string) {
    return this.webhookService.getLogs(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }
}
