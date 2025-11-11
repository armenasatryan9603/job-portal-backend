import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      referralCode?: string;
    },
  ) {
    return this.authService.signup(
      body.name,
      body.email,
      body.password,
      body.referralCode,
    );
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.newPassword);
  }

  @Post('send-otp')
  async sendOTP(@Body() body: { phone: string; isSimulator?: boolean }) {
    return this.authService.sendOTP(body.phone, body.isSimulator);
  }

  @Post('verify-otp')
  async verifyOTP(@Body() body: { phone: string; otp: string; name?: string; isSimulator?: boolean }) {
    return this.authService.verifyOTP(body.phone, body.otp, body.name, body.isSimulator);
  }

  @Post('reset-otp')
  async resetOTP(@Body() body: { phone: string; isSimulator?: boolean }) {
    return this.authService.resetOTP(body.phone, body.isSimulator);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const userId = req?.user?.userId;
    const user = await this.authService.getUserById(userId);
    return {
      id: user.id,
      email: user.email || '', // Handle null email
      name: user.name,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      role: user.role,
      creditBalance: user.creditBalance || 0,
      verified: user.verified || false,
      createdAt: user.createdAt,
    };
  }

  @Put('profile')
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
    },
  ) {
    const userId = req.user.userId;
    return this.authService.updateProfile(userId, body);
  }

  // @Put('role')
  // // @UseGuards(AuthGuard('jwt'))
  // @UseGuards(JwtAuthGuard)
  // async updateRole(@Req() req: any, @Body() body: { role: string }) {
  //   const userId = req.user.userId;
  //   return this.authService.updateRole(userId, body.role);
  // }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.logout(userId);
  }
}
