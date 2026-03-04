import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class TopDataService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.topData.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        image: true,
        activeTimes: true,
        url: true,
        sortOrder: true,
      },
    });
  }
}
