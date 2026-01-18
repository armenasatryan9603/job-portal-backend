import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import { MarketRolesService } from "./market-roles.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("market-roles")
export class MarketRolesController {
  constructor(private readonly marketRolesService: MarketRolesService) {}

  @Get("defaults")
  async getDefaultRoles() {
    return this.marketRolesService.getDefaultRoles();
  }

  @Get("market/:marketId")
  async getMarketRoles(@Param("marketId") marketId: string) {
    return this.marketRolesService.getMarketRoles(parseInt(marketId, 10));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createCustomRole(
    @Request() req,
    @Body()
    body: {
      marketId: number;
      name: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      permissions?: any;
    }
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    return this.marketRolesService.createCustomRole(
      body.marketId,
      req.user.userId,
      {
        name: body.name,
        nameEn: body.nameEn,
        nameRu: body.nameRu,
        nameHy: body.nameHy,
        permissions: body.permissions,
      }
    );
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async updateRole(
    @Param("id") id: string,
    @Request() req,
    @Body()
    body: {
      marketId: number;
      name?: string;
      nameEn?: string;
      nameRu?: string;
      nameHy?: string;
      permissions?: any;
    }
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.marketId) {
      throw new BadRequestException("marketId is required");
    }

    return this.marketRolesService.updateRole(
      parseInt(id, 10),
      body.marketId,
      req.user.userId,
      {
        name: body.name,
        nameEn: body.nameEn,
        nameRu: body.nameRu,
        nameHy: body.nameHy,
        permissions: body.permissions,
      }
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteRole(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { marketId: number }
  ) {
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!body.marketId) {
      throw new BadRequestException("marketId is required");
    }

    return this.marketRolesService.deleteRole(
      parseInt(id, 10),
      body.marketId,
      req.user.userId
    );
  }
}
