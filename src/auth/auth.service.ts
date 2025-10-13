import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PhoneVerificationService } from '../phone-verification/phone-verification.service';
import { ReferralsService } from '../referrals/referrals.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private phoneVerificationService: PhoneVerificationService,
    private referralsService: ReferralsService,
  ) {}

  async signup(
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { name, email, passwordHash: hashedPassword, role: 'user' },
    });

    // Apply referral code if provided
    let referralResult: {
      success: boolean;
      referrerId?: number;
      rewardAmount?: number;
      bonusAmount?: number;
    } | null = null;
    if (referralCode) {
      try {
        referralResult = await this.referralsService.applyReferralCode(
          referralCode,
          user.id,
        );
      } catch (error) {
        // Log error but don't fail signup if referral fails
        console.error('Referral code application failed:', error);
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      referralApplied: referralResult?.success || false,
      referralReward: referralResult?.bonusAmount || 0,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);
    return { access_token: token, user };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: number,
    updateData: {
      name?: string;
      phone?: string;
      email?: string;
      bio?: string;
      avatarUrl?: string;
      location?: string;
      role?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
    };
  }

  async updateRole(userId: number, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // Generate new JWT token with updated role
    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
      },
    };
  }

  async sendOTP(phone: string) {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await this.prisma.user.upsert({
      where: { phone },
      update: {
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
      create: {
        phone,
        name: '',
        passwordHash: 'temp_password',
        role: 'user',
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
    });

    // In production, you would send SMS here using a service like Twilio, AWS SNS, etc.
    console.log(`OTP for ${phone}: ${otp}`); // For development only

    return {
      success: true,
      message: 'OTP sent successfully',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    };
  }

  async verifyOTP(phone: string, otp: string, name?: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      throw new Error('Invalid phone number or OTP not requested');
    }

    if (user.otpCode !== otp) {
      throw new Error('Invalid OTP');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new Error('OTP has expired');
    }

    // Check phone verification before proceeding
    const phoneCheck =
      await this.phoneVerificationService.checkPhoneNumber(phone);
    console.log('📱 Phone verification result:', phoneCheck);

    // Clear OTP after successful verification and update name if provided
    const updateData: any = {
      otpCode: null,
      otpExpiresAt: null,
    };

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Track phone number for new account
    await this.phoneVerificationService.trackNewAccount(phone);

    // Generate JWT token
    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email || '', // Handle null email
      role: updatedUser.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email || '', // Handle null email
        name: updatedUser.name,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
      },
    };
  }

  async logout(userId: number) {
    // For now, we'll just return a success message
    // In a more secure implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Store logout timestamp
    // 3. Invalidate all user sessions

    return {
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async resetOTP(phone: string) {
    // Clear existing OTP for the phone number
    await this.prisma.user.updateMany({
      where: { phone },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    // Generate a new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store new OTP in database with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await this.prisma.user.upsert({
      where: { phone },
      update: {
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
      create: {
        phone,
        name: '',
        passwordHash: 'temp_password',
        role: 'user',
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
    });

    // In production, you would send SMS here using a service like Twilio, AWS SNS, etc.
    console.log(`New OTP for ${phone}: ${otp}`); // For development only

    return {
      success: true,
      message: 'OTP reset and new OTP sent successfully',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    };
  }
}
