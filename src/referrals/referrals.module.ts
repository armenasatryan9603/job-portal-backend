import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ReferralsService } from "./referrals.service";
import { ReferralsController } from "./referrals.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { CreditModule } from "../credit/credit.module";

@Module({
  imports: [NotificationsModule, CreditModule],
  providers: [ReferralsService, PrismaService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}
