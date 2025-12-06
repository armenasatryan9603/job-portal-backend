import { Module } from "@nestjs/common";
import { PeerRelationshipsService } from "./peer-relationships.service";
import { PeerRelationshipsController } from "./peer-relationships.controller";
import { PrismaService } from "../prisma.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [PeerRelationshipsController],
  providers: [PeerRelationshipsService, PrismaService],
  exports: [PeerRelationshipsService],
})
export class PeerRelationshipsModule {}
