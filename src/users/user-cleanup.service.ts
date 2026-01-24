import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class UserCleanupService {
  private readonly logger = new Logger(UserCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Hard delete users that have been soft-deleted for more than the retention period
   * @param retentionDays Number of days to retain soft-deleted users (default: 90)
   */
  async hardDeleteExpiredUsers(retentionDays: number = 90) {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);

    this.logger.log(
      `Starting cleanup of users soft-deleted before ${retentionDate.toISOString()}`
    );

    // Find users soft-deleted before the retention date
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        deletedAt: {
          not: null,
          lte: retentionDate,
        },
      },
      select: {
        id: true,
        name: true,
        deletedAt: true,
      },
    });

    if (expiredUsers.length === 0) {
      this.logger.log("No expired soft-deleted users found");
      return { deleted: 0 };
    }

    this.logger.log(`Found ${expiredUsers.length} expired soft-deleted users`);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each expired user using the existing hard delete logic
    for (const user of expiredUsers) {
      try {
        // Use a transaction to ensure all deletions happen atomically
        await this.prisma.$transaction(
          async (tx) => {
            // Delete lightweight items first
            await tx.notification.deleteMany({
              where: { userId: user.id },
            });

            await tx.savedOrder.deleteMany({
              where: { userId: user.id },
            });

            await tx.userCategory.deleteMany({
              where: { userId: user.id },
            });

            await tx.card.deleteMany({
              where: { userId: user.id },
            });

            await tx.portfolio.deleteMany({
              where: { userId: user.id },
            });

            // Keep credit transactions for financial records
            // await tx.creditTransaction.deleteMany({
            //   where: { userId: user.id },
            // });

            await tx.orderChangeHistory.deleteMany({
              where: { changedBy: user.id },
            });

            await tx.proposalPeer.deleteMany({
              where: { userId: user.id },
            });

            await tx.peerRelationship.deleteMany({
              where: { OR: [{ userId: user.id }, { peerId: user.id }] },
            });

            await tx.teamMember.deleteMany({
              where: { userId: user.id },
            });

            // Handle teams created by user
            const teamsCreatedByUser = await tx.team.findMany({
              where: { createdBy: user.id },
              include: { Members: true },
            });

            for (const team of teamsCreatedByUser) {
              const activeMembers = team.Members.filter(
                (m) => m.isActive && m.userId !== user.id
              );
              if (activeMembers.length === 0) {
                await tx.team.delete({
                  where: { id: team.id },
                });
              } else {
                const newOwner = activeMembers[0];
                await tx.team.update({
                  where: { id: team.id },
                  data: { createdBy: newOwner.userId },
                });
              }
            }

            // Delete referral rewards
            await tx.referralReward.deleteMany({
              where: { OR: [{ referrerId: user.id }, { referredUserId: user.id }] },
            });

            // Update referrals
            await tx.user.updateMany({
              where: { referredBy: user.id },
              data: { referredBy: null },
            });

            // Delete conversations
            const userConversations = await tx.conversationParticipant.findMany({
              where: { userId: user.id },
              select: { conversationId: true },
            });
            const conversationIds = userConversations.map(
              (cp) => cp.conversationId
            );
            if (conversationIds.length > 0) {
              await tx.conversation.deleteMany({
                where: { id: { in: conversationIds } },
              });
            }

            // Delete order proposals
            await tx.orderProposal.deleteMany({
              where: { OR: [{ userId: user.id }, { leadUserId: user.id }] },
            });

            // Anonymize reviews where user is specialist
            await tx.review.updateMany({
              where: { specialistId: user.id },
              data: { specialistId: null },
            });

            // Delete reviews where user is reviewer
            await tx.review.deleteMany({
              where: { reviewerId: user.id },
            });

            // Hard delete all orders (including soft-deleted permanent orders)
            // Completed bookings will be preserved as they're not cascade deleted
            await tx.order.deleteMany({
              where: { clientId: user.id },
            });

            // Finally, hard delete the user
            await tx.user.delete({
              where: { id: user.id },
            });

            deletedCount++;
            this.logger.log(`Hard deleted user ${user.id} (${user.name})`);
          },
          {
            timeout: 30000, // 30 seconds timeout
          }
        );
      } catch (error) {
        const errorMessage = `Failed to hard delete user ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    this.logger.log(
      `Cleanup completed: ${deletedCount} users hard deleted, ${errors.length} errors`
    );

    return {
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Hard delete a single user by ID
   * This will permanently delete the user and all related data
   * @param userId The ID of the user to delete
   */
  async hardDeleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    this.logger.log(`Starting hard delete for user ${userId} (${user.name})`);

    try {
      // Use a transaction to ensure all deletions happen atomically
      await this.prisma.$transaction(
        async (tx) => {
          // Delete lightweight items first
          await tx.notification.deleteMany({
            where: { userId: user.id },
          });

          await tx.savedOrder.deleteMany({
            where: { userId: user.id },
          });

          await tx.userCategory.deleteMany({
            where: { userId: user.id },
          });

          await tx.card.deleteMany({
            where: { userId: user.id },
          });

          await tx.portfolio.deleteMany({
            where: { userId: user.id },
          });

          await tx.orderChangeHistory.deleteMany({
            where: { changedBy: user.id },
          });

          await tx.proposalPeer.deleteMany({
            where: { userId: user.id },
          });

          await tx.peerRelationship.deleteMany({
            where: { OR: [{ userId: user.id }, { peerId: user.id }] },
          });

          await tx.teamMember.deleteMany({
            where: { userId: user.id },
          });

          // Handle teams created by user
          const teamsCreatedByUser = await tx.team.findMany({
            where: { createdBy: user.id },
            include: { Members: true },
          });

          for (const team of teamsCreatedByUser) {
            const activeMembers = team.Members.filter(
              (m) => m.isActive && m.userId !== user.id
            );
            if (activeMembers.length === 0) {
              await tx.team.delete({
                where: { id: team.id },
              });
            } else {
              const newOwner = activeMembers[0];
              await tx.team.update({
                where: { id: team.id },
                data: { createdBy: newOwner.userId },
              });
            }
          }

          // Delete referral rewards
          await tx.referralReward.deleteMany({
            where: { OR: [{ referrerId: user.id }, { referredUserId: user.id }] },
          });

          // Update referrals
          await tx.user.updateMany({
            where: { referredBy: user.id },
            data: { referredBy: null },
          });

          // Delete conversations
          const userConversations = await tx.conversationParticipant.findMany({
            where: { userId: user.id },
            select: { conversationId: true },
          });
          const conversationIds = userConversations.map(
            (cp) => cp.conversationId
          );
          if (conversationIds.length > 0) {
            await tx.conversation.deleteMany({
              where: { id: { in: conversationIds } },
            });
          }

          // Delete order proposals
          await tx.orderProposal.deleteMany({
            where: { OR: [{ userId: user.id }, { leadUserId: user.id }] },
          });

          // Anonymize reviews where user is specialist
          await tx.review.updateMany({
            where: { specialistId: user.id },
            data: { specialistId: null },
          });

          // Delete reviews where user is reviewer
          await tx.review.deleteMany({
            where: { reviewerId: user.id },
          });

          // Hard delete all orders (including soft-deleted permanent orders)
          // Completed bookings will be preserved as they're not cascade deleted
          await tx.order.deleteMany({
            where: { clientId: user.id },
          });

          // Finally, hard delete the user
          await tx.user.delete({
            where: { id: user.id },
          });

          this.logger.log(`Hard deleted user ${user.id} (${user.name})`);
        },
        {
          timeout: 30000, // 30 seconds timeout
        }
      );

      return { success: true, message: `User ${user.id} (${user.name}) has been permanently deleted` };
    } catch (error) {
      const errorMessage = `Failed to hard delete user ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
