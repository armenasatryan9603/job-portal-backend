import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MediaFilesService {
  constructor(private prisma: PrismaService) {}

  async createMediaFile(
    orderId: number,
    fileName: string,
    fileUrl: string,
    fileType: string,
    mimeType: string,
    fileSize: number,
    uploadedBy: number,
  ) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: uploadedBy },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${uploadedBy} not found`);
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
        createdAt: 'desc',
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
        `Media file with ID ${mediaFileId} not found`,
      );
    }

    // Check if user is the owner of the order or the uploader
    if (
      mediaFile.Order.clientId !== userId &&
      mediaFile.uploadedBy !== userId
    ) {
      throw new BadRequestException(
        'You are not authorized to delete this media file',
      );
    }

    return this.prisma.mediaFile.delete({
      where: { id: mediaFileId },
    });
  }
}
