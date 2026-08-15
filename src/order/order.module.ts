import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [NotificationsModule, AuditLogModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
