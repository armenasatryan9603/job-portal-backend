import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { CreditModule } from './credit/credit.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { OrderProposalsModule } from './order-proposals/order-proposals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MediaFilesModule } from './media-files/media-files.module';
import { StorageModule } from './storage/storage.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { ChatModule } from './chat/chat.module';
import { HiringModule } from './hiring/hiring.module';
import { OrderPricingModule } from './order-pricing/order-pricing.module';
import { ReferralsModule } from './referrals/referrals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReasonsModule } from './reasons/reasons.module';

@Module({
  imports: [
    AuthModule,
    OrdersModule,
    CreditModule,
    UsersModule,
    ServicesModule,
    OrderProposalsModule,
    ReviewsModule,
    MediaFilesModule,
    StorageModule,
    PhoneVerificationModule,
    ChatModule,
    HiringModule,
    OrderPricingModule,
    ReferralsModule,
    NotificationsModule,
    ReasonsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
