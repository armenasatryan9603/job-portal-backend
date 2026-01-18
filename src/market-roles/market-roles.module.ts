import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MarketRolesController } from "./market-roles.controller";
import { MarketRolesService } from "./market-roles.service";

@Module({
  controllers: [MarketRolesController],
  providers: [MarketRolesService, PrismaService],
  exports: [MarketRolesService],
})
export class MarketRolesModule {}
