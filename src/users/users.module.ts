import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { PortfolioService } from "./portfolio.service";
import { UserCleanupService } from "./user-cleanup.service";
import { StorageModule } from "../storage/storage.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    PortfolioService,
    UserCleanupService,
    PrismaService,
  ],
  exports: [UsersService, PortfolioService, UserCleanupService],
})
export class UsersModule {}
