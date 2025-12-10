import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Simple in-memory cache to avoid recomputing more than once per day
  private cache: { data: any; timestamp: number } | null = null;
  private static readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;

  async getPlatformStats() {
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < StatsService.ONE_DAY_MS) {
      return this.cache.data;
    }

    const [activeSpecialists, completedProjects, reviewAggregate] =
      await Promise.all([
        this.prisma.user.count({
          where: { role: "specialist" },
        }),
        this.prisma.order.count({
          where: { status: "completed" },
        }),
        this.prisma.review.aggregate({
          _avg: {
            rating: true,
          },
          _count: {
            rating: true,
          },
        }),
      ]);

    const averageRatingRaw = reviewAggregate._avg.rating ?? 0;

    const stats = {
      activeSpecialists,
      completedProjects,
      averageRating: Math.round(averageRatingRaw * 10) / 10,
      totalReviews: reviewAggregate._count.rating,
      supportAvailability: "24/7",
    };

    this.cache = {
      data: stats,
      timestamp: now,
    };

    return stats;
  }
}
