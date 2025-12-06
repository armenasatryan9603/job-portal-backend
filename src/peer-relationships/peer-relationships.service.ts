import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class PeerRelationshipsService {
  private readonly logger = new Logger(PeerRelationshipsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService
  ) {}

  /**
   * Add a peer relationship (creates pending invitation)
   */
  async addPeer(userId: number, peerId: number) {
    if (userId === peerId) {
      throw new BadRequestException("Cannot add self as peer");
    }

    // Verify both users exist and are specialists
    const [user, peer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: peerId },
        select: { id: true, role: true, name: true },
      }),
    ]);

    if (!user || user.role !== "specialist") {
      throw new NotFoundException("User not found or is not a specialist");
    }

    if (!peer || peer.role !== "specialist") {
      throw new BadRequestException("Peer must be a specialist");
    }

    // Check if relationship already exists
    const existing = await this.prisma.peerRelationship.findUnique({
      where: {
        userId_peerId: {
          userId,
          peerId,
        },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Peer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
      },
    });

    if (existing) {
      if (existing.status === "accepted" && existing.isActive) {
        // Already accepted - return existing relationship
        this.logger.log(
          `Peer relationship already exists and is accepted between user ${userId} and peer ${peerId}`
        );
        return existing;
      }
      if (existing.status === "pending") {
        // Already pending - return existing relationship (don't send duplicate notification)
        this.logger.log(
          `Peer invitation already pending from user ${userId} to peer ${peerId}, returning existing`
        );
        // Ensure isActive is true (in case it was somehow set to false)
        if (!existing.isActive) {
          return this.prisma.peerRelationship.update({
            where: {
              userId_peerId: {
                userId,
                peerId,
              },
            },
            data: {
              isActive: true,
            },
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
              Peer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  verified: true,
                  bio: true,
                  experienceYears: true,
                  priceMin: true,
                  priceMax: true,
                  location: true,
                },
              },
            },
          });
        }
        // Return with full includes matching getPeers format
        return this.prisma.peerRelationship.findUnique({
          where: {
            userId_peerId: {
              userId,
              peerId,
            },
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            Peer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                verified: true,
                bio: true,
                experienceYears: true,
                priceMin: true,
                priceMax: true,
                location: true,
              },
            },
          },
        });
      }
      // If rejected or inactive, update to pending and reactivate
      const relationship = await this.prisma.peerRelationship.update({
        where: {
          userId_peerId: {
            userId,
            peerId,
          },
        },
        data: {
          status: "pending",
          isActive: true, // Active so inviter can see pending invitations
          updatedAt: new Date(),
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          Peer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              verified: true,
            },
          },
        },
      });

      // Send notification for re-invitation
      try {
        await this.notificationsService.createNotificationWithPush(
          peerId,
          "peer_invitation",
          "notificationPeerInvitationTitle",
          "notificationPeerInvitationMessage",
          {
            type: "peer_invitation",
            peerRelationshipId: relationship.id.toString(),
            inviterId: userId.toString(),
            inviterName: user.name,
          },
          {
            inviterName: user.name,
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send peer invitation notification to user ${peerId}:`,
          error
        );
      }

      return relationship;
    }

    // Create new pending relationship
    // Set isActive: true so the inviter can see it in their list
    const relationship = await this.prisma.peerRelationship.create({
      data: {
        userId,
        peerId,
        status: "pending",
        isActive: true, // Active so inviter can see pending invitations
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Peer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
      },
    });

    // Send notification to the invited peer
    try {
      await this.notificationsService.createNotificationWithPush(
        peerId,
        "peer_invitation",
        "notificationPeerInvitationTitle",
        "notificationPeerInvitationMessage",
        {
          type: "peer_invitation",
          peerRelationshipId: relationship.id.toString(),
          inviterId: userId.toString(),
          inviterName: user.name,
        },
        {
          inviterName: user.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send peer invitation notification to user ${peerId}:`,
        error
      );
      // Don't fail the operation if notification fails
    }

    return relationship;
  }

  /**
   * Remove a peer relationship
   */
  async removePeer(userId: number, peerId: number) {
    const relationship = await this.prisma.peerRelationship.findUnique({
      where: {
        userId_peerId: {
          userId,
          peerId,
        },
      },
    });

    if (!relationship) {
      throw new NotFoundException("Peer relationship not found");
    }

    // Soft delete by setting isActive to false
    return this.prisma.peerRelationship.update({
      where: {
        userId_peerId: {
          userId,
          peerId,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get user's peer list (accepted and pending invitations sent by user)
   */
  async getPeers(userId: number) {
    const relationships = await this.prisma.peerRelationship.findMany({
      where: {
        userId,
        OR: [
          // Accepted peers
          {
            status: "accepted",
            isActive: true,
          },
          // Pending invitations sent by this user
          {
            status: "pending",
            isActive: true,
          },
        ],
      },
      include: {
        Peer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
            bio: true,
            experienceYears: true,
            priceMin: true,
            priceMax: true,
            location: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Return peers with status information (only show status if pending)
    return relationships.map((p) => ({
      ...p.Peer,
      relationshipStatus: p.status === "pending" ? "pending" : undefined,
      relationshipId: p.id,
    }));
  }

  /**
   * Get pending peer invitations (received)
   */
  async getPendingInvitations(userId: number) {
    const invitations = await this.prisma.peerRelationship.findMany({
      where: {
        peerId: userId, // Invitations received by this user
        status: "pending",
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
            bio: true,
            experienceYears: true,
            priceMin: true,
            priceMax: true,
            location: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return invitations;
  }

  /**
   * Accept peer invitation
   */
  async acceptPeerInvitation(userId: number, relationshipId: number) {
    const relationship = await this.prisma.peerRelationship.findUnique({
      where: { id: relationshipId },
      include: {
        User: {
          select: { id: true, name: true },
        },
        Peer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!relationship) {
      throw new NotFoundException("Peer invitation not found");
    }

    if (relationship.peerId !== userId) {
      throw new BadRequestException(
        "You can only accept invitations sent to you"
      );
    }

    if (relationship.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update relationship to accepted
    const updated = await this.prisma.peerRelationship.update({
      where: { id: relationshipId },
      data: {
        status: "accepted",
        isActive: true,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            verified: true,
          },
        },
      },
    });

    // Send notification to the inviter
    try {
      await this.notificationsService.createNotificationWithPush(
        relationship.userId,
        "peer_invitation_accepted",
        "notificationPeerInvitationAcceptedTitle",
        "notificationPeerInvitationAcceptedMessage",
        {
          type: "peer_invitation_accepted",
          peerRelationshipId: relationshipId.toString(),
          peerId: userId.toString(),
          peerName: relationship.Peer.name,
        },
        {
          peerName: relationship.Peer.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send peer acceptance notification to user ${relationship.userId}:`,
        error
      );
    }

    return updated;
  }

  /**
   * Reject peer invitation
   */
  async rejectPeerInvitation(userId: number, relationshipId: number) {
    const relationship = await this.prisma.peerRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new NotFoundException("Peer invitation not found");
    }

    if (relationship.peerId !== userId) {
      throw new BadRequestException(
        "You can only reject invitations sent to you"
      );
    }

    if (relationship.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update relationship to rejected
    return this.prisma.peerRelationship.update({
      where: { id: relationshipId },
      data: {
        status: "rejected",
        isActive: false,
      },
    });
  }

  /**
   * Get teams user belongs to (accepted) and teams user created (with pending members)
   * If userId is null, returns all active teams (for non-authenticated users)
   */
  async getTeams(userId: number | null) {
    // If no userId, return all active teams (public access)
    if (!userId) {
      const allTeams = await this.prisma.team.findMany({
        where: {
          isActive: true,
        },
        include: {
          Creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          Members: {
            where: {
              isActive: true,
              status: "accepted",
            },
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  verified: true,
                },
              },
            },
          },
        },
      });

      return allTeams.map((team) => ({
        ...team,
        Members: team.Members?.map((member) => ({
          ...member,
          memberStatus: undefined,
        })),
      }));
    }

    // Get teams where user is a member (accepted)
    const teamMemberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        status: "accepted",
        isActive: true,
      },
      include: {
        Team: {
          include: {
            Creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    verified: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get teams where user is the creator (include pending members)
    const createdTeams = await this.prisma.team.findMany({
      where: {
        createdBy: userId,
        isActive: true,
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Members: {
          where: {
            isActive: true,
            OR: [
              { status: "accepted" },
              { status: "pending" }, // Include pending members for team creators
            ],
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                verified: true,
              },
            },
          },
        },
      },
    });

    // Combine both lists, prioritizing createdTeams (which include pending members)
    // If user is both creator and member, use the createdTeams version
    const createdTeamIds = new Set(createdTeams.map((t) => t.id));
    const allTeams = [
      ...createdTeams, // Include created teams first (they have pending members)
      ...teamMemberships
        .map((tm) => tm.Team)
        .filter((t) => !createdTeamIds.has(t.id)), // Only include if not already in createdTeams
    ];

    // Add status information to members (only show if pending)
    return allTeams.map((team) => ({
      ...team,
      Members: team.Members?.map((member) => ({
        ...member,
        memberStatus: member.status === "pending" ? "pending" : undefined,
      })),
    }));
  }

  /**
   * Create a team
   */
  async createTeam(userId: number, name: string) {
    // Verify user exists and is a specialist
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "specialist") {
      throw new NotFoundException("User not found or is not a specialist");
    }

    // Create team with creator as lead member (auto-accepted)
    return this.prisma.team.create({
      data: {
        name,
        createdBy: userId,
        isActive: true,
        Members: {
          create: {
            userId,
            role: "lead",
            status: "accepted", // Lead is auto-accepted
            isActive: true,
          },
        },
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Members: {
          where: {
            isActive: true,
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                verified: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update team name
   */
  async updateTeamName(
    teamId: number,
    newName: string,
    requestingUserId: number
  ) {
    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, createdBy: true, isActive: true },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    if (!team.isActive) {
      throw new BadRequestException("Cannot update inactive team");
    }

    // Only team creator can update team name
    if (team.createdBy !== requestingUserId) {
      throw new BadRequestException("Only team creator can update team name");
    }

    if (!newName || newName.trim().length === 0) {
      throw new BadRequestException("Team name cannot be empty");
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        name: newName.trim(),
      },
      include: {
        Creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        Members: {
          where: {
            isActive: true,
            OR: [{ status: "accepted" }, { status: "pending" }],
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                verified: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Add member to team (creates pending invitation)
   */
  async addTeamMember(
    teamId: number,
    userId: number,
    requestingUserId: number
  ) {
    // Verify team exists and requesting user is a member
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        Members: {
          where: {
            isActive: true,
          },
        },
        Creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    if (!team.isActive) {
      throw new BadRequestException("Team is not active");
    }

    // Check if user is a member OR the team creator
    const isMember = team.Members.some((m) => m.userId === requestingUserId);
    const isCreator = team.createdBy === requestingUserId;
    if (!isMember && !isCreator) {
      throw new BadRequestException("You are not a member of this team");
    }

    // Verify user to add is a specialist
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    });

    if (!user || user.role !== "specialist") {
      throw new BadRequestException("User must be a specialist");
    }

    // Check if already a member
    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (existing) {
      if (existing.status === "accepted" && existing.isActive) {
        // Already accepted - return existing membership
        this.logger.log(
          `Team member relationship already exists and is accepted for team ${teamId} and user ${userId}`
        );
        return this.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId,
              userId,
            },
          },
          include: {
            Team: {
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
                avatarUrl: true,
              },
            },
          },
        });
      }
      if (existing.status === "pending") {
        // Already pending - return existing relationship (don't send duplicate notification)
        this.logger.log(
          `Team invitation already pending for team ${teamId} and user ${userId}, returning existing`
        );
        // Ensure isActive is true (in case it was somehow set to false)
        if (!existing.isActive) {
          return this.prisma.teamMember.update({
            where: {
              teamId_userId: {
                teamId,
                userId,
              },
            },
            data: {
              isActive: true,
            },
            include: {
              Team: {
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
                  avatarUrl: true,
                },
              },
            },
          });
        }
        // Return existing pending invitation
        return this.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId,
              userId,
            },
          },
          include: {
            Team: {
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
                avatarUrl: true,
              },
            },
          },
        });
      }
      // If rejected or inactive, update existing record to pending
      const teamMember = await this.prisma.teamMember.update({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
        data: {
          status: "pending",
          isActive: true, // Active so team creator can see pending invitations
        },
        include: {
          Team: {
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
              avatarUrl: true,
            },
          },
        },
      });

      // Send notification to the invited user
      try {
        await this.notificationsService.createNotificationWithPush(
          userId,
          "team_invitation",
          "notificationTeamInvitationTitle",
          "notificationTeamInvitationMessage",
          {
            type: "team_invitation",
            teamMemberId: teamMember.id.toString(),
            teamId: teamId.toString(),
            teamName: team.name,
            inviterId: requestingUserId.toString(),
          },
          {
            teamName: team.name,
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send team invitation notification to user ${userId}:`,
          error
        );
        // Don't fail the operation if notification fails
      }

      return teamMember;
    }

    // Create pending team member invitation
    // Set isActive: true so the team creator can see it in their list
    const teamMember = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
        status: "pending",
        isActive: true, // Active so team creator can see pending invitations
      },
      include: {
        Team: {
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
            avatarUrl: true,
          },
        },
      },
    });

    // Send notification to the invited user
    try {
      await this.notificationsService.createNotificationWithPush(
        userId,
        "team_invitation",
        "notificationTeamInvitationTitle",
        "notificationTeamInvitationMessage",
        {
          type: "team_invitation",
          teamMemberId: teamMember.id.toString(),
          teamId: teamId.toString(),
          teamName: team.name,
          inviterId: requestingUserId.toString(),
        },
        {
          teamName: team.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send team invitation notification to user ${userId}:`,
        error
      );
      // Don't fail the operation if notification fails
    }

    return teamMember;
  }

  /**
   * Get pending team invitations (received)
   */
  async getPendingTeamInvitations(userId: number) {
    const invitations = await this.prisma.teamMember.findMany({
      where: {
        userId,
        status: "pending",
      },
      include: {
        Team: {
          include: {
            Creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    return invitations;
  }

  /**
   * Accept team invitation
   */
  async acceptTeamInvitation(userId: number, teamMemberId: number) {
    const teamMember = await this.prisma.teamMember.findUnique({
      where: { id: teamMemberId },
      include: {
        Team: {
          include: {
            Creator: {
              select: { id: true, name: true },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        User: {
          select: { id: true, name: true },
        },
      },
    });

    if (!teamMember) {
      throw new NotFoundException("Team invitation not found");
    }

    if (teamMember.userId !== userId) {
      throw new BadRequestException(
        "You can only accept invitations sent to you"
      );
    }

    if (teamMember.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update team member to accepted
    const updated = await this.prisma.teamMember.update({
      where: { id: teamMemberId },
      data: {
        status: "accepted",
        isActive: true,
      },
      include: {
        Team: {
          include: {
            Creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            Members: {
              where: {
                isActive: true,
                status: "accepted",
              },
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    verified: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Send notification to team lead
    try {
      await this.notificationsService.createNotificationWithPush(
        teamMember.Team.createdBy,
        "team_invitation_accepted",
        "notificationTeamInvitationAcceptedTitle",
        "notificationTeamInvitationAcceptedMessage",
        {
          type: "team_invitation_accepted",
          teamMemberId: teamMemberId.toString(),
          teamId: teamMember.Team.id.toString(),
          teamName: teamMember.Team.name,
          memberId: userId.toString(),
          memberName: teamMember.User.name,
        },
        {
          memberName: teamMember.User.name,
          teamName: teamMember.Team.name,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send team acceptance notification to team lead ${teamMember.Team.createdBy}:`,
        error
      );
    }

    return updated;
  }

  /**
   * Reject team invitation
   */
  async rejectTeamInvitation(userId: number, teamMemberId: number) {
    const teamMember = await this.prisma.teamMember.findUnique({
      where: { id: teamMemberId },
    });

    if (!teamMember) {
      throw new NotFoundException("Team invitation not found");
    }

    if (teamMember.userId !== userId) {
      throw new BadRequestException(
        "You can only reject invitations sent to you"
      );
    }

    if (teamMember.status !== "pending") {
      throw new BadRequestException("Invitation is not pending");
    }

    // Update team member to rejected
    return this.prisma.teamMember.update({
      where: { id: teamMemberId },
      data: {
        status: "rejected",
        isActive: false,
      },
    });
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(
    teamId: number,
    userId: number,
    requestingUserId: number
  ) {
    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        createdBy: true,
        Members: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    // Check if requesting user is lead, creator, or removing themselves
    const requestingMember = team.Members.find(
      (m) => m.userId === requestingUserId
    );
    const targetMember = team.Members.find((m) => m.userId === userId);
    const isCreator = team.createdBy === requestingUserId;

    if (!requestingMember && !isCreator) {
      throw new BadRequestException("You are not a member of this team");
    }

    // Creator or lead can remove members, or user can remove themselves
    if (
      userId !== requestingUserId &&
      requestingMember?.role !== "lead" &&
      !isCreator
    ) {
      throw new BadRequestException(
        "Only team lead or creator can remove members"
      );
    }

    if (!targetMember) {
      throw new NotFoundException("Member not found in team");
    }

    // Soft delete membership
    return this.prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: {
        isActive: false,
      },
    });
  }
}
