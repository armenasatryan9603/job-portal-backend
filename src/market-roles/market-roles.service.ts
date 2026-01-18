import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class MarketRolesService {
  // Default global roles
  private readonly DEFAULT_ROLES = [
    {
      name: "owner",
      nameEn: "Owner",
      nameRu: "Владелец",
      nameHy: "Սեփականատեր",
      permissions: {
        canManageMembers: true,
        canManageOrders: true,
        canManageRoles: true,
        canEditMarket: true,
        canDeleteMarket: true,
      },
      isDefault: true,
    },
    {
      name: "admin",
      nameEn: "Admin",
      nameRu: "Администратор",
      nameHy: "Ադմինիստրատոր",
      permissions: {
        canManageMembers: true,
        canManageOrders: true,
        canManageRoles: false,
        canEditMarket: true,
        canDeleteMarket: false,
      },
      isDefault: true,
    },
    {
      name: "member",
      nameEn: "Member",
      nameRu: "Участник",
      nameHy: "Անդամ",
      permissions: {
        canManageMembers: false,
        canManageOrders: false,
        canManageRoles: false,
        canEditMarket: false,
        canDeleteMarket: false,
      },
      isDefault: true,
    },
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get default global roles
   */
  getDefaultRoles() {
    return this.DEFAULT_ROLES;
  }

  /**
   * Get all roles for a market (default + custom)
   */
  async getMarketRoles(marketId: number) {
    // Check if market exists
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Get custom roles for this market
    const customRoles = await this.prisma.marketRole.findMany({
      where: {
        marketId: marketId,
        isDefault: false,
      },
      orderBy: { createdAt: "asc" },
    });

    // Combine default roles with custom roles
    return {
      defaultRoles: this.DEFAULT_ROLES,
      customRoles: customRoles,
      allRoles: [...this.DEFAULT_ROLES, ...customRoles],
    };
  }

  /**
   * Create a custom role for a market
   */
  async createCustomRole(
    marketId: number,
    userId: number,
    data: {
      name: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      permissions?: any;
    }
  ) {
    // Check if market exists
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    // Check if user has permission (owner only)
    const member = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: userId,
        isActive: true,
        status: "accepted",
        role: "owner",
      },
    });

    if (!member && market.createdBy !== userId) {
      throw new ForbiddenException(
        "Only owners can create custom roles"
      );
    }

    // Check if role name already exists for this market
    const existingRole = await this.prisma.marketRole.findFirst({
      where: {
        marketId: marketId,
        name: data.name,
      },
    });

    if (existingRole) {
      throw new BadRequestException(
        `Role with name "${data.name}" already exists for this market`
      );
    }

    // Check if trying to use a default role name
    const defaultRoleNames = this.DEFAULT_ROLES.map((r) => r.name);
    if (defaultRoleNames.includes(data.name.toLowerCase())) {
      throw new BadRequestException(
        `Cannot create a custom role with the same name as a default role: ${data.name}`
      );
    }

    return this.prisma.marketRole.create({
      data: {
        marketId: marketId,
        name: data.name,
        nameEn: data.nameEn,
        nameRu: data.nameRu,
        nameHy: data.nameHy,
        permissions: data.permissions || {},
        isDefault: false,
      },
    });
  }

  /**
   * Update a custom role
   */
  async updateRole(
    roleId: number,
    marketId: number,
    userId: number,
    data: {
      name?: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      permissions?: any;
    }
  ) {
    // Check if role exists
    const role = await this.prisma.marketRole.findUnique({
      where: { id: roleId },
    });

    if (!role || role.marketId !== marketId) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Cannot update default roles
    if (role.isDefault) {
      throw new BadRequestException("Cannot update default roles");
    }

    // Check if user has permission (owner only)
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    const member = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: userId,
        isActive: true,
        status: "accepted",
        role: "owner",
      },
    });

    if (!member && market.createdBy !== userId) {
      throw new ForbiddenException(
        "Only owners can update custom roles"
      );
    }

    // If changing name, check for conflicts
    if (data.name && data.name !== role.name) {
      const existingRole = await this.prisma.marketRole.findFirst({
        where: {
          marketId: marketId,
          name: data.name,
          id: { not: roleId },
        },
      });

      if (existingRole) {
        throw new BadRequestException(
          `Role with name "${data.name}" already exists for this market`
        );
      }

      // Check if trying to use a default role name
      const defaultRoleNames = this.DEFAULT_ROLES.map((r) => r.name);
      if (defaultRoleNames.includes(data.name.toLowerCase())) {
        throw new BadRequestException(
          `Cannot use the same name as a default role: ${data.name}`
        );
      }
    }

    return this.prisma.marketRole.update({
      where: { id: roleId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.nameRu !== undefined && { nameRu: data.nameRu }),
        ...(data.nameHy !== undefined && { nameHy: data.nameHy }),
        ...(data.permissions !== undefined && {
          permissions: data.permissions,
        }),
      },
    });
  }

  /**
   * Delete a custom role
   */
  async deleteRole(roleId: number, marketId: number, userId: number) {
    // Check if role exists
    const role = await this.prisma.marketRole.findUnique({
      where: { id: roleId },
    });

    if (!role || role.marketId !== marketId) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Cannot delete default roles
    if (role.isDefault) {
      throw new BadRequestException("Cannot delete default roles");
    }

    // Check if user has permission (owner only)
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new NotFoundException(`Market with ID ${marketId} not found`);
    }

    const member = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        userId: userId,
        isActive: true,
        status: "accepted",
        role: "owner",
      },
    });

    if (!member && market.createdBy !== userId) {
      throw new ForbiddenException(
        "Only owners can delete custom roles"
      );
    }

    // Check if any members are using this role
    const membersWithRole = await this.prisma.marketMember.findFirst({
      where: {
        marketId: marketId,
        role: role.name,
        isActive: true,
      },
    });

    if (membersWithRole) {
      throw new BadRequestException(
        "Cannot delete role that is currently assigned to members. Please reassign members first."
      );
    }

    await this.prisma.marketRole.delete({
      where: { id: roleId },
    });

    return { success: true };
  }
}
