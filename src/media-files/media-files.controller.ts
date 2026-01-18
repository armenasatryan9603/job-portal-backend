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
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MediaFilesService } from "./media-files.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { VercelBlobService } from "../storage/vercel-blob.service";
import { memoryStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";

@Controller("media-files")
export class MediaFilesController {
  constructor(
    private readonly mediaFilesService: MediaFilesService,
    private readonly vercelBlobService: VercelBlobService
  ) {}

  // @UseGuards(JwtAuthGuard)
  @Post("presigned-url")
  async generatePresignedUrl(
    @Request() req,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      orderId: number;
    }
  ) {
    try {
      const { uploadUrl, fileUrl, fileName } =
        await this.vercelBlobService.generateSignedUploadUrl(
          body.fileName,
          body.mimeType,
          body.orderId
        );

      return {
        uploadUrl,
        fileUrl,
        fileName,
        orderId: body.orderId,
      };
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      throw new BadRequestException("Failed to generate upload URL");
    }
  }

  @Post("upload")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        // Allow images and videos
        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "video/mp4",
          "video/mov",
          "video/avi",
          "video/quicktime",
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException("File type not supported"), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    })
  )
  async uploadMediaFile(@Request() req, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Parse body fields from FormData (req.body is available with multer)
    const orderId = req.body?.orderId
      ? parseInt(req.body.orderId.toString())
      : null;
    const fileType = req.body?.fileType
      ? req.body.fileType.toString()
      : file.mimetype.startsWith("image/")
        ? "image"
        : "video";

    // Generate unique filename for Vercel Blob
    // Use a temporary path if orderId is not provided
    const pathPrefix = orderId ? `orders/${orderId}` : "temp";
    const uniqueName = `${pathPrefix}/${uuidv4()}${extname(file.originalname)}`;

    // Upload to Vercel Blob
    const fileUrl = await this.vercelBlobService.uploadFile(
      file.buffer,
      uniqueName,
      file.mimetype,
      orderId || 0 // Pass 0 for temp uploads, but we won't create DB record
    );

    // Get user ID from request (required since we have JwtAuthGuard)
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    // If orderId is provided, create MediaFile record immediately
    // Otherwise, just return the fileUrl (will be created when order is created)
    if (orderId) {
      return this.mediaFilesService.createMediaFile(
        orderId,
        file.originalname,
        fileUrl,
        fileType,
        file.mimetype,
        file.size,
        userId
      );
    }

    // For temporary uploads (orderId is null), just return the file info
    // The MediaFile record will be created when the order is created
    return {
      fileUrl,
      fileName: file.originalname,
      fileType,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
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
    }
  ) {
    return this.mediaFilesService.createMediaFile(
      body.orderId,
      body.fileName,
      body.fileUrl,
      body.fileType,
      body.mimeType,
      body.fileSize,
      req.user?.userId || 1 // Use default user ID 1 if no auth
    );
  }

  @Get("order/:orderId")
  async getMediaFilesByOrder(@Param("orderId", ParseIntPipe) orderId: number) {
    return this.mediaFilesService.getMediaFilesByOrder(orderId);
  }

  // @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getMediaFileById(@Param("id", ParseIntPipe) id: number) {
    return this.mediaFilesService.getMediaFileById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async deleteMediaFile(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.mediaFilesService.deleteMediaFile(id, req.user.userId);
  }

  /**
   * Market media file endpoints
   */

  @Post("markets/presigned-url")
  async generateMarketPresignedUrl(
    @Request() req,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      marketId: number;
    }
  ) {
    try {
      const { uploadUrl, fileUrl, fileName } =
        await this.vercelBlobService.generateSignedUploadUrl(
          body.fileName,
          body.mimeType,
          body.marketId
        );

      return {
        uploadUrl,
        fileUrl,
        fileName,
        marketId: body.marketId,
      };
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      throw new BadRequestException("Failed to generate upload URL");
    }
  }

  @Post("markets/upload")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "video/mp4",
          "video/mov",
          "video/avi",
          "video/quicktime",
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException("File type not supported"), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    })
  )
  async uploadMarketMediaFile(@Request() req, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const marketId = req.body?.marketId
      ? parseInt(req.body.marketId.toString())
      : null;
    const fileType = req.body?.fileType
      ? req.body.fileType.toString()
      : file.mimetype.startsWith("image/")
        ? "image"
        : "video";

    const pathPrefix = marketId ? `markets/${marketId}` : "temp";
    const uniqueName = `${pathPrefix}/${uuidv4()}${extname(file.originalname)}`;

    const fileUrl = await this.vercelBlobService.uploadFile(
      file.buffer,
      uniqueName,
      file.mimetype,
      marketId || 0
    );

    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (marketId) {
      return this.mediaFilesService.createMarketMediaFile(
        marketId,
        file.originalname,
        fileUrl,
        fileType,
        file.mimetype,
        file.size,
        userId
      );
    }

    return {
      fileUrl,
      fileName: file.originalname,
      fileType,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  @Post("markets")
  async createMarketMediaFile(
    @Request() req,
    @Body()
    body: {
      marketId: number;
      fileName: string;
      fileUrl: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    }
  ) {
    return this.mediaFilesService.createMarketMediaFile(
      body.marketId,
      body.fileName,
      body.fileUrl,
      body.fileType,
      body.mimeType,
      body.fileSize,
      req.user?.userId || 1
    );
  }

  @Get("markets/:marketId")
  async getMarketMediaFiles(@Param("marketId", ParseIntPipe) marketId: number) {
    return this.mediaFilesService.getMarketMediaFiles(marketId);
  }

  @Get("markets/file/:id")
  async getMarketMediaFileById(@Param("id", ParseIntPipe) id: number) {
    return this.mediaFilesService.getMarketMediaFileById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("markets/:id")
  async deleteMarketMediaFile(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    return this.mediaFilesService.deleteMarketMediaFile(id, req.user.userId);
  }
}
