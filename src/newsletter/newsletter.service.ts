import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  async subscribe(email: string) {
    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, isActive: true },
    });
    // ponytail: welcome email stub
    return subscriber;
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletterSubscriber.update({
      where: { email },
      data: { isActive: false },
    });
    return { message: 'Unsubscribed successfully' };
  }

  getSubscribers() {
    return this.prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
