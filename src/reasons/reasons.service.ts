import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReasonsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active reasons
   */
  async findAll() {
    return this.prisma.reason.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get a single reason by ID
   */
  async findOne(id: number) {
    return this.prisma.reason.findUnique({
      where: { id },
    });
  }

  /**
   * Get a reason by code
   */
  async findByCode(code: string) {
    return this.prisma.reason.findUnique({
      where: { code },
    });
  }
}
