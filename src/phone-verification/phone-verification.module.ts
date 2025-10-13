import { Module } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { PhoneVerificationController } from './phone-verification.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PhoneVerificationController],
  providers: [PhoneVerificationService, PrismaService],
  exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
