import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class TopDataService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(country?: string) {
    const where: any = {};

    if (country) {
      const code = country.trim().toUpperCase().slice(0, 2);
      if (code) {
        where.OR = [{ country: code }, { country: null }];
      }
    }

    return this.prisma.topData.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        image: true,
        country: true,
        action: true,
        url: true,
        sortOrder: true,
      },
    });
  }
}
