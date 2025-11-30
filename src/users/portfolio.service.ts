import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { VercelBlobService } from "../storage/vercel-blob.service";

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private vercelBlobService: VercelBlobService
  ) {}

  async createPortfolioItem(
    userId: number,
    fileName: string,
    fileUrl: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    title?: string,
    description?: string
  ) {
    // Check if user exists and is a specialist
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.role !== "specialist") {
      throw new BadRequestException(
        "Only specialists can upload portfolio items"
      );
    }

    return this.prisma.portfolio.create({
      data: {
        userId,
        fileName,
        fileUrl,
        fileType,
        mimeType,
        fileSize,
        title,
        description,
      },
    });
  }

  async getPortfolioByUser(userId: number) {
    return this.prisma.portfolio.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getPortfolioItemById(id: number) {
    return this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async updatePortfolioItem(
    id: number,
    userId: number,
    title?: string,
    description?: string
  ) {
    const portfolioItem = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolioItem) {
      throw new NotFoundException(`Portfolio item with ID ${id} not found`);
    }

    if (portfolioItem.userId !== userId) {
      throw new BadRequestException(
        "You are not authorized to update this portfolio item"
      );
    }

    return this.prisma.portfolio.update({
      where: { id },
      data: {
        title,
        description,
      },
    });
  }

  async deletePortfolioItem(id: number, userId: number) {
    const portfolioItem = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolioItem) {
      throw new NotFoundException(`Portfolio item with ID ${id} not found`);
    }

    if (portfolioItem.userId !== userId) {
      throw new BadRequestException(
        "You are not authorized to delete this portfolio item"
      );
    }

    // Delete from database first
    const deletedItem = await this.prisma.portfolio.delete({
      where: { id },
    });

    // Delete from Vercel Blob
    if (deletedItem.fileUrl) {
      try {
        await this.vercelBlobService.deleteFile(deletedItem.fileUrl);
        console.log(
          `Portfolio file deleted from Vercel Blob: ${deletedItem.fileUrl}`
        );
      } catch (error) {
        console.error(
          `Failed to delete portfolio file from Vercel Blob: ${deletedItem.fileUrl}`,
          error
        );
        // Don't throw error - file is already deleted from DB
      }
    }

    return deletedItem;
  }
}
