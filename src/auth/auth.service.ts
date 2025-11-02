import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { PhoneVerificationService } from "../phone-verification/phone-verification.service";
import { ReferralsService } from "../referrals/referrals.service";
import { UniClient } from "uni-sdk";

@Injectable()
export class AuthService {
  private unimtxClient: UniClient | null = null;
  private unimtxAccessKeyId: string;
  private unimtxAccessKeySecret: string;
  private unimtxTemplateId: string;
  private unimtxSenderId: string;
  private smsEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private phoneVerificationService: PhoneVerificationService,
    private referralsService: ReferralsService
  ) {
    // Initialize Unimtx SMS
    this.unimtxAccessKeyId = process.env.UNIMTX_ACCESS_KEY_ID || "";
    this.unimtxAccessKeySecret = process.env.UNIMTX_ACCESS_KEY_SECRET || "";
    this.unimtxTemplateId = process.env.UNIMTX_TEMPLATE_ID || "f781135d";
    this.unimtxSenderId = process.env.UNIMTX_SENDER_ID || "asdf";
    this.smsEnabled = !!this.unimtxAccessKeyId && !!this.unimtxAccessKeySecret;

    if (this.smsEnabled) {
      this.unimtxClient = new UniClient({
        accessKeyId: this.unimtxAccessKeyId,
        accessKeySecret: this.unimtxAccessKeySecret,
      });
      console.log("✅ Unimtx SMS service initialized");
    } else {
      console.log(
        "⚠️  Unimtx SMS not configured - OTP will be logged to console only"
      );
    }
  }

  /**
   * Send SMS via Unimtx
   */
  private async sendSMS(phone: string, message: string): Promise<boolean> {
    if (!this.unimtxClient) {
      console.error("❌ Unimtx client not initialized");
      return false;
    }

    try {
      // Clean phone number: ensure E.164 format
      const cleanPhone = phone.replace(/[\s\-]/g, "");

      const response = await this.unimtxClient.messages.send({
        to: cleanPhone,
        text: message,
      });

      if (
        response &&
        ((response as any).id ||
          (response as any).messageId ||
          (response as any).message_id)
      ) {
        const messageId =
          (response as any).id ||
          (response as any).messageId ||
          (response as any).message_id;
        console.log(
          `📱 SMS sent to ${phone} via Unimtx (MessageId: ${messageId})`
        );
        return true;
      } else {
        console.error("❌ Unimtx error: No MessageId returned");
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to send SMS via Unimtx:", error.message);
      return false;
    }
  }

  async signup(
    name: string,
    email: string,
    password: string,
    referralCode?: string
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { name, email, passwordHash: hashedPassword, role: "user" },
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
          user.id
        );
      } catch (error) {
        // Log error but don't fail signup if referral fails
        console.error("Referral code application failed:", error);
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
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException("Invalid credentials");

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);
    return { access_token: token, user };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    });

    return { message: "Password updated successfully" };
  }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
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
    }
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
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
      throw new UnauthorizedException("User not found");
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
    // Clean phone number: ensure E.164 format
    const cleanPhone = phone.replace(/[\s\-]/g, "");

    // Send OTP via Unimtx if configured, otherwise generate and store locally
    if (this.smsEnabled && this.unimtxClient) {
      try {
        const response = await this.unimtxClient.otp.send({
          to: cleanPhone,
          templateId: this.unimtxTemplateId,
          signature: this.unimtxSenderId,
        });

        // Check Unimtx response structure: code "0" means success
        const responseData = response as any;
        if (responseData && responseData.code === "0" && responseData.data) {
          const messageId = responseData.data.id;
          if (messageId) {
            console.log(
              `📱 OTP sent to ${phone} via Unimtx (MessageId: ${messageId})`
            );
            return {
              success: true,
              message: "OTP sent successfully",
            };
          } else {
            throw new Error("No MessageId in Unimtx response data");
          }
        } else if (responseData && responseData.code !== "0") {
          throw new Error(`Unimtx API error: code ${responseData.code}`);
        } else {
          throw new Error("Invalid response structure from Unimtx");
        }
      } catch (error) {
        console.error("❌ Failed to send OTP via Unimtx:", error.message);
        // Fall back to console logging
        console.log(`OTP for ${phone}: ${error.message}`);
        throw new Error("Failed to send verification code. Please try again.");
      }
    } else {
      // Unimtx not configured - generate OTP and log to console
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`OTP for ${phone}: ${otp}`);

      return {
        success: true,
        message: "OTP sent successfully",
        // In development, return OTP for testing
        ...(process.env.NODE_ENV === "development" && { otp }),
      };
    }
  }

  async verifyOTP(phone: string, otp: string, name?: string) {
    // Clean phone number: ensure E.164 format
    const cleanPhone = phone.replace(/[\s\-]/g, "");

    // Verify OTP via Unimtx if configured, otherwise use local verification
    if (this.smsEnabled && this.unimtxClient) {
      try {
        const response = await this.unimtxClient.otp.verify({
          to: cleanPhone,
          code: otp,
        });

        if (!response.valid) {
          throw new Error("Invalid OTP");
        }

        console.log(`✅ OTP verified successfully for ${phone} via Unimtx`);
      } catch (error) {
        console.error("❌ Failed to verify OTP via Unimtx:", error.message);
        throw new Error("Invalid OTP");
      }
    } else {
      // Fallback to local verification when Unimtx is not configured
      const user = await this.prisma.user.findUnique({
        where: { phone },
      });

      if (!user || !user.otpCode || !user.otpExpiresAt) {
        throw new Error("Invalid phone number or OTP not requested");
      }

      if (user.otpCode !== otp) {
        throw new Error("Invalid OTP");
      }

      if (new Date() > user.otpExpiresAt) {
        throw new Error("OTP has expired");
      }
    }

    // Check phone verification before proceeding
    const phoneCheck =
      await this.phoneVerificationService.checkPhoneNumber(phone);
    console.log("📱 Phone verification result:", phoneCheck);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await this.prisma.user.create({
        data: {
          phone,
          name: name?.trim() || "",
          passwordHash: "temp_password",
          role: "user",
        },
      });
    } else {
      // Update existing user
      const updateData: any = {};

      if (name && name.trim()) {
        updateData.name = name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    // Track phone number for new account
    await this.phoneVerificationService.trackNewAccount(phone);

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email || "", // Handle null email
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email || "", // Handle null email
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
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
      message: "Logged out successfully",
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
        name: "",
        passwordHash: "temp_password",
        role: "user",
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
    });

    // Send SMS if Brevo is configured, otherwise log to console
    if (this.smsEnabled) {
      const message = `Your new verification code is: ${otp}. This code will expire in 5 minutes.`;
      const smsSent = await this.sendSMS(phone, message);

      if (!smsSent) {
        // Fall back to console logging if SMS fails
        console.log(`New OTP for ${phone}: ${otp}`);
        throw new Error("Failed to send verification code. Please try again.");
      }
    } else {
      // Brevo not configured - log OTP to console
      console.log(`New OTP for ${phone}: ${otp}`);
    }

    return {
      success: true,
      message: "OTP reset and new OTP sent successfully",
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === "development" && { otp }),
    };
  }
}
