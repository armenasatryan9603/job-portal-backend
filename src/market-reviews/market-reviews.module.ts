import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MarketReviewsController } from "./market-reviews.controller";
import { MarketReviewsService } from "./market-reviews.service";

@Module({
  controllers: [MarketReviewsController],
  providers: [MarketReviewsService, PrismaService],
  exports: [MarketReviewsService],
})
export class MarketReviewsModule {}
