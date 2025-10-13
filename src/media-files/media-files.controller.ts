import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaFilesService } from './media-files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GcsService } from '../storage/gcs.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('media-files')
export class MediaFilesController {
  constructor(
    private readonly mediaFilesService: MediaFilesService,
    private readonly gcsService: GcsService,
  ) {}

  // @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  async generatePresignedUrl(
    @Request() req,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      orderId: number;
    },
  ) {
    try {
      const { uploadUrl, fileUrl, fileName } =
        await this.gcsService.generateSignedUploadUrl(
          body.fileName,
          body.mimeType,
          body.orderId,
        );

      return {
        uploadUrl,
        fileUrl,
        fileName,
        orderId: body.orderId,
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new BadRequestException('Failed to generate upload URL');
    }
  }

  // @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/media',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow images and videos
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/mov',
          'video/avi',
          'video/quicktime',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException('File type not supported'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async uploadMediaFile(
    @Request() req,
    @UploadedFile() file: any,
    @Body()
    body: {
      orderId: string;
      fileType: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const orderId = parseInt(body.orderId);
    const fileUrl = `/uploads/media/${file.filename}`;
    const fileType =
      body.fileType || (file.mimetype.startsWith('image/') ? 'image' : 'video');

    return this.mediaFilesService.createMediaFile(
      orderId,
      file.originalname,
      fileUrl,
      fileType,
      file.mimetype,
      file.size,
      req.user?.userId || 1, // Use default user ID 1 if no auth
    );
  }

  // @UseGuards(JwtAuthGuard)
  @Post()
  async createMediaFile(
    @Request() req,
    @Body()
    body: {
      orderId: number;
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    },
  ) {
    return this.mediaFilesService.createMediaFile(
      body.orderId,
      body.fileName,
      body.fileUrl,
      body.fileType,
      body.mimeType,
      body.fileSize,
      req.user?.userId || 1, // Use default user ID 1 if no auth
    );
  }

  @Get('order/:orderId')
  async getMediaFilesByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.mediaFilesService.getMediaFilesByOrder(orderId);
  }

  // @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getMediaFileById(@Param('id', ParseIntPipe) id: number) {
    return this.mediaFilesService.getMediaFileById(id);
  }

  // @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteMediaFile(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.mediaFilesService.deleteMediaFile(id, req.user.userId);
  }
}
