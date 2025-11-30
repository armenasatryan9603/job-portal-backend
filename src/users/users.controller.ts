import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  BadRequestException,
  Request,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { UsersService } from "./users.service";
import { PortfolioService } from "./portfolio.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { VercelBlobService } from "../storage/vercel-blob.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly portfolioService: PortfolioService,
    private readonly vercelBlobService: VercelBlobService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("role") role?: string
  ) {
    return this.usersService.findAll(parseInt(page), parseInt(limit), role);
  }

  @Get("search")
  @UseGuards(JwtAuthGuard)
  async searchUsers(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    if (!query) {
      return {
        users: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    return this.usersService.searchUsers(
      query,
      parseInt(page),
      parseInt(limit)
    );
  }

  // @Get('role/:role')
  // @UseGuards(JwtAuthGuard)
  // async getUsersByRole(
  //   @Param('role') role: string,
  //   @Query('page') page: string = '1',
  //   @Query('limit') limit: string = '10',
  // ) {
  //   return this.usersService.getUsersByRole(
  //     role,
  //     parseInt(page),
  //     parseInt(limit),
  //   );
  // }

  @Patch(":id")
  // @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body()
    updateUserDto: {
      name?: string;
      email?: string;
      phone?: string;
      bio?: string;
      avatarUrl?: string;
      role?: string;
      verified?: boolean;
    }
  ) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Patch(":id/password")
  @UseGuards(JwtAuthGuard)
  async updatePassword(
    @Param("id") id: string,
    @Body() body: { newPassword: string }
  ) {
    return this.usersService.updatePassword(+id, body.newPassword);
  }

  @Patch(":id/credit")
  @UseGuards(JwtAuthGuard)
  async updateCreditBalance(
    @Param("id") id: string,
    @Body() body: { amount: number }
  ) {
    return this.usersService.updateCreditBalance(+id, body.amount);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    return this.usersService.remove(+id);
  }

  // Specialist endpoints
  @Post(":id/specialist-profile")
  @UseGuards(JwtAuthGuard)
  async createSpecialistProfile(
    @Param("id") id: string,
    @Body()
    specialistData: {
      serviceId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
    }
  ) {
    return this.usersService.createSpecialistProfile(+id, specialistData);
  }

  @Get("specialists")
  async getSpecialists(
    @Request() req,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("serviceId") serviceId?: string,
    @Query("location") location?: string
  ) {
    try {
      // Extract userId from JWT token if available
      let userId: number | undefined;

      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.substring(7);
          const jwt = require("jsonwebtoken");
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "yourSecretKey"
          );
          userId = decoded.sub;
        }
      } catch (jwtError) {
        // JWT is invalid or missing, continue without user
        console.log(
          "No valid JWT token found, proceeding without user context"
        );
      }

      console.log("Getting specialists with params:", {
        page,
        limit,
        serviceId,
        location,
        userId,
      });

      const result = await this.usersService.getSpecialists(
        parseInt(page),
        parseInt(limit),
        serviceId ? parseInt(serviceId) : undefined,
        location,
        userId
      );

      return result;
    } catch (error) {
      console.error("Error in getSpecialists controller:", error);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  @Get("specialists/search")
  async searchSpecialists(
    @Query("q") query: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    if (!query) {
      return {
        specialists: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    return this.usersService.searchSpecialists(
      query,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("specialists/service/:serviceId")
  async getSpecialistsByService(
    @Param("serviceId") serviceId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.usersService.getSpecialistsByService(
      parseInt(serviceId),
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("specialists/location/:location")
  async getSpecialistsByLocation(
    @Param("location") location: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.usersService.getSpecialistsByLocation(
      location,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get("specialists/:id")
  async getSpecialistById(@Param("id") id: string) {
    return this.usersService.getSpecialistById(+id);
  }

  @Patch("specialists/:id")
  @UseGuards(JwtAuthGuard)
  async updateSpecialistProfile(
    @Param("id") id: string,
    @Body()
    specialistData: {
      serviceId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
    }
  ) {
    return this.usersService.updateSpecialistProfile(+id, specialistData);
  }

  // User service management endpoints
  @Post(":id/services")
  @UseGuards(JwtAuthGuard)
  async addUserService(
    @Param("id") id: string,
    @Body() body: { serviceId: number; notificationsEnabled?: boolean }
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.usersService.addUserService(
      userId,
      body.serviceId,
      body.notificationsEnabled ?? true
    );
  }

  @Delete(":id/services/:serviceId")
  @UseGuards(JwtAuthGuard)
  async removeUserService(
    @Param("id") id: string,
    @Param("serviceId") serviceId: string
  ) {
    const userId = parseInt(id, 10);
    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    if (isNaN(serviceIdNum)) {
      throw new BadRequestException(`Invalid service ID: ${serviceId}`);
    }
    return this.usersService.removeUserService(userId, serviceIdNum);
  }

  @Patch(":id/services/:serviceId/notifications")
  @UseGuards(JwtAuthGuard)
  async updateUserServiceNotifications(
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
    @Body() body: { notificationsEnabled: boolean }
  ) {
    const userId = parseInt(id, 10);
    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    if (isNaN(serviceIdNum)) {
      throw new BadRequestException(`Invalid service ID: ${serviceId}`);
    }
    return this.usersService.updateUserServiceNotifications(
      userId,
      serviceIdNum,
      body.notificationsEnabled
    );
  }

  @Get(":id/services")
  @UseGuards(JwtAuthGuard)
  async getUserServices(@Param("id") id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.usersService.getUserServices(userId);
  }

  @Get(":id")
  // @UseGuards(JwtAuthGuard)
  async findOne(@Param("id") id: string) {
    console.log("Received id parameter:", id, "type:", typeof id);
    console.log("Parsed id:", parseInt(id, 10));
    console.log("Is NaN:", isNaN(parseInt(id, 10)));

    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.usersService.findOne(userId);
  }

  // Portfolio endpoints
  @Get(":id/portfolio")
  async getPortfolio(@Param("id") id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.portfolioService.getPortfolioByUser(userId);
  }

  @Post("portfolio/upload")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        // Allow only images
        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
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
  async uploadPortfolioItem(
    @Request() req,
    @UploadedFile() file: any,
    @Body() body: { title?: string; description?: string }
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    // Generate unique filename for Vercel Blob
    const pathPrefix = `portfolio/${userId}`;
    const uniqueName = `${pathPrefix}/${uuidv4()}${extname(file.originalname)}`;

    // Upload to Vercel Blob
    const fileUrl = await this.vercelBlobService.uploadFile(
      file.buffer,
      uniqueName,
      file.mimetype,
      0 // No orderId for portfolio items
    );

    const fileType = file.mimetype.startsWith("image/") ? "image" : "video";

    return this.portfolioService.createPortfolioItem(
      userId,
      file.originalname,
      fileUrl,
      fileType,
      file.mimetype,
      file.size,
      body.title,
      body.description
    );
  }

  @Patch("portfolio/:id")
  @UseGuards(JwtAuthGuard)
  async updatePortfolioItem(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { title?: string; description?: string }
  ) {
    const portfolioId = parseInt(id, 10);
    if (isNaN(portfolioId)) {
      throw new BadRequestException(`Invalid portfolio ID: ${id}`);
    }
    return this.portfolioService.updatePortfolioItem(
      portfolioId,
      req.user.userId,
      body.title,
      body.description
    );
  }

  @Delete("portfolio/:id")
  @UseGuards(JwtAuthGuard)
  async deletePortfolioItem(@Param("id") id: string, @Request() req) {
    const portfolioId = parseInt(id, 10);
    if (isNaN(portfolioId)) {
      throw new BadRequestException(`Invalid portfolio ID: ${id}`);
    }
    return this.portfolioService.deletePortfolioItem(
      portfolioId,
      req.user.userId
    );
  }
}
