import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { PortfolioService } from "./portfolio.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [UsersController],
  providers: [UsersService, PortfolioService, PrismaService],
  exports: [UsersService, PortfolioService],
})
export class UsersModule {}
