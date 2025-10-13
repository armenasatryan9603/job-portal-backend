import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  controllers: [CreditController],
  providers: [CreditService, PrismaService],
})
export class CreditModule {}
