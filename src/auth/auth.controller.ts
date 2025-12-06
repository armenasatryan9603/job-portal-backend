import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthGuard } from "@nestjs/passport";
import { UserLanguage } from "../types/user-languages";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("signup")
  async signup(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      referralCode?: string;
    }
  ) {
    return this.authService.signup(
      body.name,
      body.email,
      body.password,
      body.referralCode
    );
  }

  @Post("login")
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post("reset-password")
  async resetPassword(@Body() body: { email: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.newPassword);
  }

  @Post("send-otp")
  async sendOTP(@Body() body: { phone: string; isSimulator?: boolean }) {
    return this.authService.sendOTP(body.phone, body.isSimulator);
  }

  @Post("verify-otp")
  async verifyOTP(
    @Body()
    body: {
      phone: string;
      otp: string;
      name?: string;
      isSimulator?: boolean;
      referralCode?: string;
    }
  ) {
    return this.authService.verifyOTP(
      body.phone,
      body.otp,
      body.name,
      body.isSimulator,
      body.referralCode
    );
  }

  @Post("reset-otp")
  async resetOTP(@Body() body: { phone: string; isSimulator?: boolean }) {
    return this.authService.resetOTP(body.phone, body.isSimulator);
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const userId = req?.user?.userId;
    const user = await this.authService.getUserById(userId);
    return {
      id: user.id,
      email: user.email || "", // Handle null email
      name: user.name,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      role: user.role,
      creditBalance: user.creditBalance || 0,
      verified: user.verified || false,
      languages: (user.languages as unknown as UserLanguage[]) || [],
      createdAt: user.createdAt,
      experienceYears: user.experienceYears || undefined,
      priceMin: user.priceMin,
      priceMax: user.priceMax,
      location: user.location,
    };
  }

  @Put("profile")
  // @UseGuards(AuthGuard('jwt'))
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body()
    body: {
      name?: string;
      phone?: string;
      email?: string;
      bio?: string;
      avatarUrl?: string;
      location?: string;
      role?: string;
      languages?: UserLanguage[];
      experienceYears?: number;
    }
  ) {
    const userId = req.user.userId;
    return this.authService.updateProfile(userId, body);
  }

  @Get("preferences")
  @UseGuards(JwtAuthGuard)
  async getPreferences(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.getPreferences(userId);
  }

  @Put("preferences")
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Req() req: any,
    @Body()
    body: {
      language?: "en" | "ru" | "hy";
      theme?: "light" | "dark" | "auto";
      pushNotificationsEnabled?: boolean;
      emailNotificationsEnabled?: boolean;
      timezone?: string;
      dateFormat?: string;
    }
  ) {
    const userId = req.user.userId;
    return this.authService.updatePreferences(userId, body);
  }

  // @Put('role')
  // // @UseGuards(AuthGuard('jwt'))
  // @UseGuards(JwtAuthGuard)
  // async updateRole(@Req() req: any, @Body() body: { role: string }) {
  //   const userId = req.user.userId;
  //   return this.authService.updateRole(userId, body.role);
  // }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.logout(userId);
  }
}
