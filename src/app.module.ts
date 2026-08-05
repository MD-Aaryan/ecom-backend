import { Module } from '@nestjs/common';
import 'dotenv/config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { redisStore } from 'cache-manager-redis-yet';
import Redis from 'ioredis';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CategoryModule } from './category/category.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
import { ProductModule } from './product/product.module';
import { ReviewModule } from './review/review.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CartModule } from './cart/cart.module';
import { CouponModule } from './coupon/coupon.module';
import { OrderModule } from './order/order.module';
import { ReturnModule } from './return/return.module';
import { AdminModule } from './admin/admin.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { SupportModule } from './support/support.module';
import { WebhookModule } from './webhooks/webhook.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';

const redisConfigured = Boolean(process.env.REDIS_HOST);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: (config: ConfigService): any => {
        const redisHost = config.get<string>('REDIS_HOST');
        if (redisHost) {
          const redisClient = new Redis({
            host: redisHost,
            port: config.get('REDIS_PORT', 6379),
            maxRetriesPerRequest: 2,
            lazyConnect: true,
          });
          return {
            store: redisStore,
            redis: redisClient,
            ttl: 60,
            max: 200,
          };
        }
        return { ttl: 60, max: 200 };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    ...(redisConfigured
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('REDIS_HOST'),
                port: config.get('REDIS_PORT', 6379),
              },
            }),
          }),
          WebhookModule,
        ]
      : []),
    PrismaModule,
    AuthModule,
    UserModule,
    CloudinaryModule,
    CategoryModule,
    SubcategoryModule,
    ProductModule,
    ReviewModule,
    WishlistModule,
    CartModule,
    CouponModule,
    OrderModule,
    ReturnModule,
    AdminModule,
    NewsletterModule,
    AuditLogModule,
    SupportModule,
    HealthModule,
    NotificationsModule,
    TasksModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
