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
    this.unimtxSenderId = process.env.UNIMTX_SENDER_ID || "GorcKa";

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
      // Clean phone number: remove spaces and dashes
      let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

      // Format phone number: ensure E.164 format with country code
      if (!cleanPhone.startsWith("+")) {
        // If it starts with 0, remove it and add country code
        if (cleanPhone.startsWith("0")) {
          cleanPhone = "+374" + cleanPhone.substring(1); // Remove leading 0, add Armenia country code
        } else if (cleanPhone.startsWith("374")) {
          // Already has country code without +
          cleanPhone = "+" + cleanPhone;
        } else {
          // Assume it's a local number, add country code
          cleanPhone = "+374" + cleanPhone;
        }
      }
      // If it already starts with +, keep it as is

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

    // Get welcome bonus amount from environment variable
    const welcomeBonus = parseFloat(process.env.WELCOME_BONUS_AMOUNT || "5.0");

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: "user",
        creditBalance: welcomeBonus, // Give welcome bonus to all new users
      },
    });

    console.log(
      `✅ User created with ID: ${user.id} - Welcome bonus: ${welcomeBonus} credits`
    );

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

  async sendOTP(phone: string, isSimulator: boolean = false) {
    // Clean phone number: remove spaces and dashes
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

    // Format phone number: ensure E.164 format with country code
    if (!cleanPhone.startsWith("+")) {
      // If it starts with 0, remove it and add country code
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "+374" + cleanPhone.substring(1); // Remove leading 0, add Armenia country code
      } else if (cleanPhone.startsWith("374")) {
        // Already has country code without +
        cleanPhone = "+" + cleanPhone;
      } else {
        // Assume it's a local number, add country code
        cleanPhone = "+374" + cleanPhone;
      }
    }
    // If it already starts with +, keep it as is

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    try {
      await this.prisma.user.upsert({
        where: { phone: cleanPhone },
        update: {
          otpCode: otp,
          otpExpiresAt: expiresAt,
        },
        create: {
          phone: cleanPhone,
          name: "",
          passwordHash: "temp_password",
          role: "user",
          otpCode: otp,
          otpExpiresAt: expiresAt,
        },
      });
    } catch (error) {
      console.error("Database error while storing OTP:", error);
      // Check if it's a connection error
      if (
        error instanceof Error &&
        (error.message.includes("Can't reach database server") ||
          error.message.includes("P1001") ||
          error.message.includes("connection"))
      ) {
        throw new Error(
          "Database connection failed. Please check your DATABASE_URL and ensure the database server is running."
        );
      }
      // Re-throw other errors
      throw error;
    }

    // If simulator mode, skip sending real SMS and just log
    if (isSimulator) {
      console.log(`🧪 [SIMULATOR] OTP for ${phone}: ${otp}`);
      return {
        success: true,
        message: "OTP sent successfully (simulator mode)",
        otp: otp, // Return OTP for simulator
      };
    }

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
        console.log(`OTP for ${phone}: ${otp}`);
        throw new Error("Failed to send verification code. Please try again.");
      }
    } else {
      // Unimtx not configured - log OTP to console
      console.log(`OTP for ${phone}: ${otp}`);

      return {
        success: true,
        message: "OTP sent successfully",
        // In development, return OTP for testing
        ...(process.env.NODE_ENV === "development" && { otp }),
      };
    }
  }

  async verifyOTP(
    phone: string,
    otp: string,
    name?: string,
    isSimulator: boolean = false,
    referralCode?: string
  ) {
    // Clean phone number: ensure E.164 format
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

    // Format phone number: ensure E.164 format with country code
    if (!cleanPhone.startsWith("+")) {
      // If it starts with 0, remove it and add country code
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "+374" + cleanPhone.substring(1); // Remove leading 0, add Armenia country code
      } else if (cleanPhone.startsWith("374")) {
        // Already has country code without +
        cleanPhone = "+" + cleanPhone;
      } else {
        // Assume it's a local number, add country code
        cleanPhone = "+374" + cleanPhone;
      }
    }
    // If it already starts with +, keep it as is

    // If simulator mode, skip Unimtx verification and use local verification
    if (isSimulator) {
      console.log(`🧪 [SIMULATOR] Verifying OTP locally for ${phone}`);
      // Fall through to local verification below
    } else if (this.smsEnabled && this.unimtxClient) {
      // Verify OTP via Unimtx if configured and not simulator
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
    }

    // Local verification (used for simulator or when Unimtx is not configured)
    if (isSimulator || !this.smsEnabled || !this.unimtxClient) {
      // Fallback to local verification when Unimtx is not configured
      // Use cleanPhone for consistency
      const user = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
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

    // Check phone verification before proceeding - use cleanPhone
    try {
      const phoneCheck =
        await this.phoneVerificationService.checkPhoneNumber(cleanPhone);
      console.log("📱 Phone verification result:", phoneCheck);
    } catch (error) {
      console.error("❌ Error checking phone number:", error.message);
      // Continue anyway - don't fail the whole process
    }

    // Find or create user - use cleanPhone for consistency
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
      });

      if (!user) {
        // Create new user if doesn't exist
        console.log(`📝 Creating new user with phone: ${cleanPhone}`);

        // Get welcome bonus amount from environment variable
        const welcomeBonus = parseFloat(
          process.env.WELCOME_BONUS_AMOUNT || "5.0"
        );

        user = await this.prisma.user.create({
          data: {
            phone: cleanPhone, // Use formatted phone number
            name: name?.trim() || "",
            passwordHash: "temp_password",
            role: "user",
            creditBalance: welcomeBonus, // Give welcome bonus to all new users
          },
        });
        console.log(
          `✅ User created with ID: ${user.id} - Welcome bonus: ${welcomeBonus} credits`
        );
      } else {
        console.log(`👤 Found existing user with ID: ${user.id}`);
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
          console.log(`✅ User updated`);
        }
      }
    } catch (error) {
      console.error("❌ Error finding/creating user:", error.message);
      console.error("❌ Error details:", error);
      throw new Error(`Failed to create or update user: ${error.message}`);
    }

    // Track phone number for new account - use cleanPhone
    try {
      await this.phoneVerificationService.trackNewAccount(cleanPhone);
    } catch (error) {
      console.error("❌ Error tracking phone number:", error.message);
      // Continue anyway - don't fail the whole process
    }

    // Apply referral code if provided (only for new users or users without referral)
    if (referralCode && user) {
      try {
        // Check if user was already referred
        const existingReferral = await this.prisma.referralReward.findFirst({
          where: { referredUserId: user.id },
        });

        // Only apply if user hasn't been referred before
        if (!existingReferral) {
          await this.referralsService.applyReferralCode(referralCode, user.id);
          console.log(
            `✅ Referral code ${referralCode} applied for user ${user.id}`
          );
        } else {
          console.log(
            `ℹ️ User ${user.id} was already referred, skipping referral code`
          );
        }
      } catch (error) {
        // Log error but don't fail signup if referral fails
        console.error("❌ Referral code application failed:", error.message);
      }
    }

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

  async resetOTP(phone: string, isSimulator: boolean = false) {
    // Clean phone number: remove spaces and dashes
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

    // Format phone number: ensure E.164 format with country code
    if (!cleanPhone.startsWith("+")) {
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "+374" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("374")) {
        cleanPhone = "+" + cleanPhone;
      } else {
        cleanPhone = "+374" + cleanPhone;
      }
    }

    // Clear existing OTP for the phone number
    await this.prisma.user.updateMany({
      where: { phone: cleanPhone },
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
      where: { phone: cleanPhone },
      update: {
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
      create: {
        phone: cleanPhone,
        name: "",
        passwordHash: "temp_password",
        role: "user",
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
    });

    // If simulator mode, skip sending real SMS and just log
    if (isSimulator) {
      console.log(`🧪 [SIMULATOR] Reset OTP for ${phone}: ${otp}`);
      return {
        success: true,
        message: "OTP reset and new OTP sent successfully (simulator mode)",
        otp: otp, // Return OTP for simulator
      };
    }

    // Send SMS if configured, otherwise log to console
    if (this.smsEnabled && this.unimtxClient) {
      try {
        const response = await this.unimtxClient.otp.send({
          to: cleanPhone,
          templateId: this.unimtxTemplateId,
          signature: this.unimtxSenderId,
        });

        const responseData = response as any;
        if (responseData && responseData.code === "0" && responseData.data) {
          const messageId = responseData.data.id;
          if (messageId) {
            console.log(
              `📱 Reset OTP sent to ${phone} via Unimtx (MessageId: ${messageId})`
            );
            return {
              success: true,
              message: "OTP reset and new OTP sent successfully",
            };
          } else {
            throw new Error("No MessageId in Unimtx response data");
          }
        } else {
          throw new Error(`Unimtx API error: code ${responseData?.code}`);
        }
      } catch (error) {
        console.error("❌ Failed to send reset OTP via Unimtx:", error.message);
        console.log(`Reset OTP for ${phone}: ${otp}`);
        throw new Error("Failed to send verification code. Please try again.");
      }
    } else {
      // Not configured - log OTP to console
      console.log(`Reset OTP for ${phone}: ${otp}`);
    }

    return {
      success: true,
      message: "OTP reset and new OTP sent successfully",
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === "development" && { otp }),
    };
  }
}
