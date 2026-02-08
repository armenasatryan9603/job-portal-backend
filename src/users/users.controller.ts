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
  ForbiddenException,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import type { Request as ExpressRequest, Response } from "express";
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
  async remove(@Param("id") id: string, @Req() req: any) {
    const currentUserId = req?.user?.userId;
    const targetUserId = +id;

    // Users can only delete their own account (unless they're admin)
    if (currentUserId !== targetUserId && req?.user?.role !== "admin") {
      throw new ForbiddenException("You can only delete your own account");
    }

    return this.usersService.remove(targetUserId);
  }

  // Specialist endpoints
  @Post(":id/specialist-profile")
  @UseGuards(JwtAuthGuard)
  async createSpecialistProfile(
    @Param("id") id: string,
    @Body()
    specialistData: {
      categoryId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
      currency?: string;
      rateUnit?: string;
    }
  ) {
    return this.usersService.createSpecialistProfile(+id, specialistData);
  }

  @Get("specialists")
  async getSpecialists(
    @Req() req,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("categoryId") categoryId?: string,
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
        categoryId,
        location,
        userId,
      });

      const result = await this.usersService.getSpecialists(
        parseInt(page),
        parseInt(limit),
        categoryId ? parseInt(categoryId) : undefined,
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

  @Get("specialists/category/:categoryId")
  async getSpecialistsByCategory(
    @Param("categoryId") categoryId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.usersService.getSpecialistsByCategory(
      parseInt(categoryId),
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
  async getSpecialistById(
    @Param("id") id: string,
    @Req() req: ExpressRequest,
    @Res() res: Response
  ) {
    const specialistId = parseInt(id, 10);
    if (isNaN(specialistId)) {
      throw new BadRequestException(`Invalid specialist ID: ${id}`);
    }

    // Check if this is a web browser request (for Universal Links)
    const acceptHeader = req.headers["accept"] || "";
    const isWebRequest =
      acceptHeader.includes("text/html") ||
      req.headers["user-agent"]?.includes("Mozilla");

    if (isWebRequest) {
      // Serve HTML page for Universal Links
      const specialist = await this.usersService.getSpecialistById(specialistId);
      const safeName = (specialist.User?.name || "")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      const safeBio = (specialist.User?.bio || "")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName || `Specialist #${specialistId}`} - HotWork</title>
  <meta name="description" content="${safeBio || safeName}">
  
  <!-- Universal Links / App Links meta tags -->
  <meta property="al:ios:url" content="jobportalmobile://specialists/${specialistId}">
  <meta property="al:ios:app_name" content="HotWork">
  <meta property="al:android:url" content="jobportalmobile://specialists/${specialistId}">
  <meta property="al:android:app_name" content="HotWork">
  <meta property="al:android:package" content="com.jobportalmobile.app">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 16px 0; color: #333; }
    .specialist-info { margin: 16px 0; }
    .specialist-info p { margin: 8px 0; color: #666; }
    .open-app-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #007AFF;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
  </style>
  
  <script>
    // Try to open the app immediately
    window.location.href = "jobportalmobile://specialists/${specialistId}";
    
    // Fallback: if app doesn't open after 2 seconds, show the page
    setTimeout(function() {
      document.getElementById('fallback').style.display = 'block';
      document.getElementById('loading').style.display = 'none';
    }, 2000);
  </script>
</head>
<body>
  <div class="container">
    <h1>${safeName || `Specialist #${specialistId}`}</h1>
    <div id="loading" style="text-align: center; margin-top: 20px; color: #999;">
      Opening in app...
    </div>
    <div id="fallback" style="display: none;">
      <div class="specialist-info">
        <p><strong>Name:</strong> ${safeName || "N/A"}</p>
        <p><strong>Bio:</strong> ${safeBio || "N/A"}</p>
        <p><strong>Rating:</strong> ${specialist.averageRating || "N/A"} (${specialist.reviewCount || 0} reviews)</p>
        <p><strong>Location:</strong> ${specialist.User?.location || "N/A"}</p>
      </div>
      <a href="jobportalmobile://specialists/${specialistId}" class="open-app-btn">
        Open in HotWork App
      </a>
    </div>
  </div>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    }

    // Return JSON for API requests
    const specialist = await this.usersService.getSpecialistById(specialistId);
    return res.json(specialist);
  }

  @Patch("specialists/:id")
  @UseGuards(JwtAuthGuard)
  async updateSpecialistProfile(
    @Param("id") id: string,
    @Body()
    specialistData: {
      categoryId?: number;
      experienceYears?: number;
      priceMin?: number;
      priceMax?: number;
      location?: string;
    }
  ) {
    return this.usersService.updateSpecialistProfile(+id, specialistData);
  }

  @Post(":id/categories")
  @UseGuards(JwtAuthGuard)
  async addUserCategoryAlt(
    @Param("id") id: string,
    @Body() body: { categoryId: number; notificationsEnabled?: boolean }
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.usersService.addUserCategory(
      userId,
      body.categoryId,
      body.notificationsEnabled ?? true
    );
  }

  @Delete(":id/categories/:categoryId")
  @UseGuards(JwtAuthGuard)
  async removeUserCategory(
    @Param("id") id: string,
    @Param("categoryId") categoryId: string
  ) {
    const userId = parseInt(id, 10);
    const categoryIdNum = parseInt(categoryId, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    if (isNaN(categoryIdNum)) {
      throw new BadRequestException(`Invalid category ID: ${categoryId}`);
    }
    return this.usersService.removeUserCategory(userId, categoryIdNum);
  }

  @Patch(":id/categories/:categoryId/notifications")
  @UseGuards(JwtAuthGuard)
  async updateUserCategoryNotifications(
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Body() body: { notificationsEnabled: boolean }
  ) {
    const userId = parseInt(id, 10);
    const categoryIdNum = parseInt(categoryId, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    if (isNaN(categoryIdNum)) {
      throw new BadRequestException(`Invalid category ID: ${categoryId}`);
    }
    return this.usersService.updateUserCategoryNotifications(
      userId,
      categoryIdNum,
      body.notificationsEnabled
    );
  }

  @Get(":id/categories")
  @UseGuards(JwtAuthGuard)
  async getUserCategories(@Param("id") id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException(`Invalid user ID: ${id}`);
    }
    return this.usersService.getUserCategories(userId);
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
    @Req() req,
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
    @Req() req,
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
  async deletePortfolioItem(@Param("id") id: string, @Req() req) {
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
