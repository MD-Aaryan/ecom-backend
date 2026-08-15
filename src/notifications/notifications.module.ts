import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationService } from './notification.service';

@Module({
  providers: [MailService, NotificationService],
  exports: [MailService, NotificationService],
})
export class NotificationsModule {}