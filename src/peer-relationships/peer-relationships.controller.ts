import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { PeerRelationshipsService } from "./peer-relationships.service";
import { TeamPortfolioService } from "./team-portfolio.service";
import { VercelBlobService } from "../storage/vercel-blob.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";

@Controller("peers")
export class PeerRelationshipsController {
  constructor(
    private readonly peerRelationshipsService: PeerRelationshipsService,
    private readonly teamPortfolioService: TeamPortfolioService,
    private readonly vercelBlobService: VercelBlobService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async addPeer(@Request() req, @Body() body: { peerId: number }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.addPeer(userId, body.peerId);
  }

  @Delete(":peerId")
  @UseGuards(JwtAuthGuard)
  async removePeer(
    @Request() req,
    @Param("peerId", ParseIntPipe) peerId: number
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.removePeer(userId, peerId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getPeers(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.getPeers(userId);
  }

  @Get("invitations/pending")
  @UseGuards(JwtAuthGuard)
  async getPendingInvitations(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.getPendingInvitations(userId);
  }

  @Post("invitations/:relationshipId/accept")
  @UseGuards(JwtAuthGuard)
  async acceptPeerInvitation(
    @Request() req,
    @Param("relationshipId", ParseIntPipe) relationshipId: number
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.acceptPeerInvitation(
      userId,
      relationshipId
    );
  }

  @Post("invitations/:relationshipId/reject")
  @UseGuards(JwtAuthGuard)
  async rejectPeerInvitation(
    @Request() req,
    @Param("relationshipId", ParseIntPipe) relationshipId: number
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.rejectPeerInvitation(
      userId,
      relationshipId
    );
  }

  @Get("teams")
  @UseGuards(OptionalJwtAuthGuard)
  async getTeams(@Request() req) {
    const userId = req.user?.userId;
    // Allow both authenticated and non-authenticated users
    // If authenticated, return user's teams; if not, return all public teams
    return this.peerRelationshipsService.getTeams(userId || null);
  }

  @Get("teams/invitations/pending")
  @UseGuards(JwtAuthGuard)
  async getPendingTeamInvitations(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.getPendingTeamInvitations(userId);
  }

  @Post("teams/invitations/:teamMemberId/accept")
  @UseGuards(JwtAuthGuard)
  async acceptTeamInvitation(
    @Request() req,
    @Param("teamMemberId", ParseIntPipe) teamMemberId: number
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.acceptTeamInvitation(
      userId,
      teamMemberId
    );
  }

  @Post("teams/invitations/:teamMemberId/reject")
  @UseGuards(JwtAuthGuard)
  async rejectTeamInvitation(
    @Request() req,
    @Param("teamMemberId", ParseIntPipe) teamMemberId: number
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.rejectTeamInvitation(
      userId,
      teamMemberId
    );
  }

  @Post("teams")
  @UseGuards(JwtAuthGuard)
  async createTeam(@Request() req, @Body() body: { name: string }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.createTeam(userId, body.name);
  }

  @Post("teams/:teamId/members")
  @UseGuards(JwtAuthGuard)
  async addTeamMember(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Body() body: { userId: number }
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.addTeamMember(
      teamId,
      body.userId,
      requestingUserId
    );
  }

  @Delete("teams/:teamId/members/:userId")
  @UseGuards(JwtAuthGuard)
  async removeTeamMember(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Param("userId", ParseIntPipe) userId: number
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.removeTeamMember(
      teamId,
      userId,
      requestingUserId
    );
  }

  @Patch("teams/:teamId")
  @UseGuards(JwtAuthGuard)
  async updateTeam(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Body()
    body: {
      name?: string;
      bannerUrl?: string | null;
      description?: string | null;
    }
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.updateTeam(
      teamId,
      body,
      requestingUserId
    );
  }

  /**
   * @deprecated Use PATCH /teams/:teamId instead
   */
  @Patch("teams/:teamId/name")
  @UseGuards(JwtAuthGuard)
  async updateTeamName(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Body() body: { name: string }
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.updateTeam(
      teamId,
      { name: body.name },
      requestingUserId
    );
  }

  // Team Portfolio/Gallery endpoints
  @Get("teams/:teamId/gallery")
  @UseGuards(OptionalJwtAuthGuard)
  async getTeamGallery(
    @Param("teamId", ParseIntPipe) teamId: number
  ) {
    return this.teamPortfolioService.getTeamPortfolioByTeam(teamId);
  }

  @Post("teams/:teamId/gallery/upload")
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
  async uploadTeamGalleryItem(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @UploadedFile() file: any,
    @Body() body: { title?: string; description?: string }
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new BadRequestException("User not authenticated");
    }

    // Generate unique filename for Vercel Blob
    const pathPrefix = `team-portfolio/${teamId}`;
    const uniqueName = `${pathPrefix}/${uuidv4()}${extname(file.originalname)}`;

    // Upload to Vercel Blob
    const fileUrl = await this.vercelBlobService.uploadFile(
      file.buffer,
      uniqueName,
      file.mimetype,
      0 // No orderId for portfolio items
    );

    const fileType = file.mimetype.startsWith("image/") ? "image" : "video";

    return this.teamPortfolioService.createTeamPortfolioItem(
      teamId,
      requestingUserId,
      file.originalname,
      fileUrl,
      fileType,
      file.mimetype,
      file.size,
      body.title,
      body.description
    );
  }

  @Patch("teams/:teamId/gallery/:id")
  @UseGuards(JwtAuthGuard)
  async updateTeamGalleryItem(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { title?: string; description?: string }
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.teamPortfolioService.updateTeamPortfolioItem(
      id,
      requestingUserId,
      body.title,
      body.description
    );
  }

  @Delete("teams/:teamId/gallery/:id")
  @UseGuards(JwtAuthGuard)
  async deleteTeamGalleryItem(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Param("id", ParseIntPipe) id: number
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.teamPortfolioService.deleteTeamPortfolioItem(
      id,
      requestingUserId
    );
  }
}
