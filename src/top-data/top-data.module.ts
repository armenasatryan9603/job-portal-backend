import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { TopDataController } from "./top-data.controller";
import { TopDataService } from "./top-data.service";

@Module({
  controllers: [TopDataController],
  providers: [TopDataService, PrismaService],
  exports: [TopDataService],
})
export class TopDataModule {}
