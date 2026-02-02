import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { CardsModule } from "./cards/cards.module";
import { CategoriesModule } from "./categories/categories.module";
import { ChatModule } from "./chat/chat.module";
import { ConstantsModule } from "./constants/constants.module";
import { CreditModule } from "./credit/credit.module";
import { ExchangeRateModule } from "./exchange-rate/exchange-rate.module";
import { HiringModule } from "./hiring/hiring.module";
import { MarketReviewsModule } from "./market-reviews/market-reviews.module";
import { MarketRolesModule } from "./market-roles/market-roles.module";
import { MarketsModule } from "./markets/markets.module";
import { MediaFilesModule } from "./media-files/media-files.module";
import { Module } from "@nestjs/common";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrderPricingModule } from "./order-pricing/order-pricing.module";
import { OrderProposalsModule } from "./order-proposals/order-proposals.module";
import { OrdersModule } from "./orders/orders.module";
import { PeerRelationshipsModule } from "./peer-relationships/peer-relationships.module";
import { PhoneVerificationModule } from "./phone-verification/phone-verification.module";
import { PrismaService } from "./prisma.service";
import { PusherModule } from "./pusher/pusher.module";
import { ReasonsModule } from "./reasons/reasons.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SkillsModule } from "./skills/skills.module";
import { StatsModule } from "./stats/stats.module";
import { StorageModule } from "./storage/storage.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { TranslationsModule } from "./translations/translations.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PusherModule,
    AuthModule,
    OrdersModule,
    CreditModule,
    CardsModule,
    UsersModule,
    CategoriesModule,
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
    TranslationsModule,
    PeerRelationshipsModule,
    StatsModule,
    ConstantsModule,
    SkillsModule,
    AdminModule,
    SubscriptionsModule,
    ExchangeRateModule,
    BookingsModule,
    MarketsModule,
    MarketReviewsModule,
    MarketRolesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
