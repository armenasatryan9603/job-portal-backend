import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { VercelBlobService } from "../storage/vercel-blob.service";

@Injectable()
export class MediaFilesService {
  constructor(
    private prisma: PrismaService,
    private vercelBlobService: VercelBlobService
  ) {}

  async createMediaFile(
    orderId: number,
    fileName: string,
    fileUrl: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    uploadedBy: number
  ) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if user exists (skip check for default user ID 1 - used for unauthenticated uploads)
    if (uploadedBy !== 1) {
      const user = await this.prisma.user.findUnique({
        where: { id: uploadedBy },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${uploadedBy} not found`);
      }
    }

    return this.prisma.mediaFile.create({
      data: {
        orderId,
        fileName,
        fileUrl,
        fileType,
        mimeType,
        fileSize,
        uploadedBy,
      },
      include: {
        Order: {
          select: {
            id: true,
            title: true,
          },
        },
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

  async getMediaFilesByOrder(orderId: number) {
    return this.prisma.mediaFile.findMany({
      where: { orderId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getMediaFileById(id: number) {
    return this.prisma.mediaFile.findUnique({
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

  async deleteMediaFile(mediaFileId: number, userId: number) {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
      include: {
        Order: true,
      },
    });

    if (!mediaFile) {
      throw new NotFoundException(
        `Media file with ID ${mediaFileId} not found`
      );
    }

    // Check if user is the owner of the order or the uploader
    if (
      mediaFile.Order &&
      mediaFile.Order.clientId !== userId &&
      mediaFile.uploadedBy !== userId
    ) {
      throw new BadRequestException(
        "You are not authorized to delete this media file"
      );
    }

    // If no order, check if user is the uploader
    if (!mediaFile.Order && mediaFile.uploadedBy !== userId) {
      throw new BadRequestException(
        "You are not authorized to delete this media file"
      );
    }

    // Delete from database first
    const deletedMediaFile = await this.prisma.mediaFile.delete({
      where: { id: mediaFileId },
    });

    // Delete from Vercel Blob using the full URL
    if (deletedMediaFile.fileUrl) {
      try {
        await this.vercelBlobService.deleteFile(deletedMediaFile.fileUrl);
        console.log(
          `File deleted from Vercel Blob: ${deletedMediaFile.fileUrl}`
        );
      } catch (error) {
        console.error(
          `Failed to delete file from Vercel Blob: ${deletedMediaFile.fileUrl}`,
          error
        );
        // Don't throw error - file is already deleted from DB
      }
    }

    return deletedMediaFile;
  }

  /**
   * Create media file for market
   */
  async createMarketMediaFile(
    marketId: number,
    fileName: string,
    fileUrl: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    uploadedBy: number
  ) {
    // Check if market exists
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check if user exists
    if (uploadedBy !== 1) {
      const user = await this.prisma.user.findUnique({
        where: { id: uploadedBy },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${uploadedBy} not found`);
      }
    }

    return this.prisma.marketMediaFile.create({
      data: {
        marketId,
        fileName,
        fileUrl,
        fileType,
        mimeType,
        fileSize,
        uploadedBy,
      },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
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

  /**
   * Get media files for a market
   */
  async getMarketMediaFiles(marketId: number) {
    return this.prisma.marketMediaFile.findMany({
      where: { marketId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Get market media file by ID
   */
  async getMarketMediaFileById(id: number) {
    return this.prisma.marketMediaFile.findUnique({
      where: { id },
      include: {
        Market: {
          select: {
            id: true,
            name: true,
          },
        },
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

  /**
   * Delete market media file
   */
  async deleteMarketMediaFile(mediaFileId: number, userId: number) {
    const mediaFile = await this.prisma.marketMediaFile.findUnique({
      where: { id: mediaFileId },
      include: {
        Market: true,
      },
    });

    if (!mediaFile) {
      throw new NotFoundException(
        `Market media file with ID ${mediaFileId} not found`
      );
    }

    // Check if user has permission (market owner, admin, or uploader)
    const member = await this.prisma.marketMember.findFirst({
      where: {
        marketId: mediaFile.marketId,
        userId: userId,
        isActive: true,
        status: "accepted",
        role: {
          in: ["owner", "admin"],
        },
      },
    });

    if (
      !member &&
      mediaFile.Market.createdBy !== userId &&
      mediaFile.uploadedBy !== userId
    ) {
      throw new BadRequestException(
        "You are not authorized to delete this media file"
      );
    }

    // Delete from database first
    const deletedMediaFile = await this.prisma.marketMediaFile.delete({
      where: { id: mediaFileId },
    });

    // Delete from Vercel Blob
    if (deletedMediaFile.fileUrl) {
      try {
        await this.vercelBlobService.deleteFile(deletedMediaFile.fileUrl);
      } catch (error) {
        console.error(
          `Failed to delete file from Vercel Blob: ${deletedMediaFile.fileUrl}`,
          error
        );
      }
    }

    return deletedMediaFile;
  }
}
