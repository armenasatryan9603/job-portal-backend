import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { VercelBlobService } from "../storage/vercel-blob.service";

@Injectable()
export class TeamPortfolioService {
  constructor(
    private prisma: PrismaService,
    private vercelBlobService: VercelBlobService
  ) {}

  async createTeamPortfolioItem(
    teamId: number,
    requestingUserId: number,
    fileName: string,
    fileUrl: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    title?: string,
    description?: string
  ) {
    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, createdBy: true, isActive: true },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    if (!team.isActive) {
      throw new BadRequestException("Cannot add items to inactive team");
    }

    // Only team creator can add portfolio items
    if (team.createdBy !== requestingUserId) {
      throw new BadRequestException(
        "Only team creator can add portfolio items"
      );
    }

    return this.prisma.teamPortfolio.create({
      data: {
        teamId,
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

  async getTeamPortfolioByTeam(teamId: number) {
    return this.prisma.teamPortfolio.findMany({
      where: { teamId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getTeamPortfolioItemById(id: number) {
    return this.prisma.teamPortfolio.findUnique({
      where: { id },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            createdBy: true,
          },
        },
      },
    });
  }

  async updateTeamPortfolioItem(
    id: number,
    requestingUserId: number,
    title?: string,
    description?: string
  ) {
    const portfolioItem = await this.prisma.teamPortfolio.findUnique({
      where: { id },
      include: {
        Team: {
          select: {
            id: true,
            createdBy: true,
          },
        },
      },
    });

    if (!portfolioItem) {
      throw new NotFoundException(`Portfolio item with ID ${id} not found`);
    }

    if (portfolioItem.Team.createdBy !== requestingUserId) {
      throw new BadRequestException(
        "You are not authorized to update this portfolio item"
      );
    }

    return this.prisma.teamPortfolio.update({
      where: { id },
      data: {
        title,
        description,
      },
    });
  }

  async deleteTeamPortfolioItem(id: number, requestingUserId: number) {
    const portfolioItem = await this.prisma.teamPortfolio.findUnique({
      where: { id },
      include: {
        Team: {
          select: {
            id: true,
            createdBy: true,
          },
        },
      },
    });

    if (!portfolioItem) {
      throw new NotFoundException(`Portfolio item with ID ${id} not found`);
    }

    if (portfolioItem.Team.createdBy !== requestingUserId) {
      throw new BadRequestException(
        "You are not authorized to delete this portfolio item"
      );
    }

    // Delete from database first
    const deletedItem = await this.prisma.teamPortfolio.delete({
      where: { id },
    });

    // Delete from Vercel Blob
    if (deletedItem.fileUrl) {
      try {
        await this.vercelBlobService.deleteFile(deletedItem.fileUrl);
        console.log(
          `Team portfolio file deleted from Vercel Blob: ${deletedItem.fileUrl}`
        );
      } catch (error) {
        console.error(
          `Failed to delete team portfolio file from Vercel Blob: ${deletedItem.fileUrl}`,
          error
        );
        // Don't throw error - file is already deleted from DB
      }
    }

    return deletedItem;
  }
}

