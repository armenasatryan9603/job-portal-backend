import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReasonsService } from './reasons.service';
import { ReasonsController } from './reasons.controller';

@Module({
  controllers: [ReasonsController],
  providers: [ReasonsService, PrismaService],
  exports: [ReasonsService],
})
export class ReasonsModule {}
