import { Module } from '@nestjs/common';
import { ReturnService } from './return.service';
import { ReturnController } from './return.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReturnController],
  providers: [ReturnService, PrismaService],
})
export class ReturnModule {}
