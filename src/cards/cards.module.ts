import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CardsController],
  providers: [CardsService, PrismaService],
  exports: [CardsService],
})
export class CardsModule {}
