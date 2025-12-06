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
} from "@nestjs/common";
import { PeerRelationshipsService } from "./peer-relationships.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";

@Controller("peers")
export class PeerRelationshipsController {
  constructor(
    private readonly peerRelationshipsService: PeerRelationshipsService
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
  async updateTeamName(
    @Request() req,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Body() body: { name: string }
  ) {
    const requestingUserId = req.user?.userId;
    if (!requestingUserId) {
      throw new Error("User ID not found in authentication token");
    }
    return this.peerRelationshipsService.updateTeamName(
      teamId,
      body.name,
      requestingUserId
    );
  }
}
