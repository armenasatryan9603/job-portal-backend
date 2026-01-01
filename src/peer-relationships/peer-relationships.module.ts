import { Module } from "@nestjs/common";
import { PeerRelationshipsService } from "./peer-relationships.service";
import { PeerRelationshipsController } from "./peer-relationships.controller";
import { TeamPortfolioService } from "./team-portfolio.service";
import { PrismaService } from "../prisma.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { VercelBlobService } from "../storage/vercel-blob.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PeerRelationshipsController],
  providers: [
    PeerRelationshipsService,
    TeamPortfolioService,
    PrismaService,
    VercelBlobService,
  ],
  exports: [PeerRelationshipsService, TeamPortfolioService],
})
export class PeerRelationshipsModule {}
