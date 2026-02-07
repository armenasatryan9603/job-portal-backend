import * as bcrypt from "bcrypt";

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserLanguage, isValidUserLanguage } from "../types/user-languages";

import { JwtService } from "@nestjs/jwt";
import { PhoneVerificationService } from "../phone-verification/phone-verification.service";
import { PrismaService } from "../prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { UniClient } from "uni-sdk";

/** Separator for location: "address__ISO" */
const LOCATION_COUNTRY_SEPARATOR = "__";

/** Phone dial code (without +) → ISO 3166-1 alpha-2. Used to set user country from login. */
const DIAL_CODE_TO_ISO: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "20": "EG",
  "27": "ZA",
  "30": "GR",
  "31": "NL",
  "32": "BE",
  "33": "FR",
  "34": "ES",
  "36": "HU",
  "39": "IT",
  "40": "RO",
  "41": "CH",
  "43": "AT",
  "44": "GB",
  "45": "DK",
  "46": "SE",
  "47": "NO",
  "48": "PL",
  "49": "DE",
  "51": "PE",
  "52": "MX",
  "53": "CU",
  "54": "AR",
  "55": "BR",
  "56": "CL",
  "57": "CO",
  "58": "VE",
  "61": "AU",
  "62": "ID",
  "63": "PH",
  "64": "NZ",
  "81": "JP",
  "82": "KR",
  "86": "CN",
  "90": "TR",
  "91": "IN",
  "92": "PK",
  "93": "AF",
  "94": "LK",
  "98": "IR",
  "212": "MA",
  "213": "DZ",
  "216": "TN",
  "218": "LY",
  "220": "GM",
  "221": "SN",
  "223": "ML",
  "224": "GN",
  "225": "CI",
  "226": "BF",
  "227": "NE",
  "228": "TG",
  "229": "BJ",
  "230": "MU",
  "231": "LR",
  "232": "SL",
  "233": "GH",
  "234": "NG",
  "235": "TD",
  "236": "CF",
  "237": "CM",
  "238": "CV",
  "239": "ST",
  "240": "GQ",
  "241": "GA",
  "242": "CG",
  "243": "CD",
  "244": "AO",
  "245": "GW",
  "246": "IO",
  "248": "SC",
  "249": "SD",
  "250": "RW",
  "251": "ET",
  "252": "SO",
  "253": "DJ",
  "254": "KE",
  "255": "TZ",
  "256": "UG",
  "257": "BI",
  "258": "MZ",
  "260": "ZM",
  "261": "MG",
  "262": "RE",
  "263": "ZW",
  "264": "NA",
  "265": "MW",
  "266": "LS",
  "267": "BW",
  "268": "SZ",
  "269": "KM",
  "290": "SH",
  "291": "ER",
  "297": "AW",
  "298": "FO",
  "299": "GL",
  "350": "GI",
  "351": "PT",
  "352": "LU",
  "353": "IE",
  "354": "IS",
  "355": "AL",
  "356": "MT",
  "357": "CY",
  "358": "FI",
  "359": "BG",
  "370": "LT",
  "371": "LV",
  "372": "EE",
  "373": "MD",
  "374": "AM",
  "375": "BY",
  "376": "AD",
  "377": "MC",
  "378": "SM",
  "379": "VA",
  "380": "UA",
  "381": "RS",
  "382": "ME",
  "383": "XK",
  "385": "HR",
  "386": "SI",
  "387": "BA",
  "389": "MK",
  "420": "CZ",
  "421": "SK",
  "423": "LI",
  "500": "FK",
  "501": "BZ",
  "502": "GT",
  "503": "SV",
  "504": "HN",
  "505": "NI",
  "506": "CR",
  "507": "PA",
  "508": "PM",
  "509": "HT",
  "590": "GP",
  "591": "BO",
  "592": "GY",
  "593": "EC",
  "594": "GF",
  "595": "PY",
  "596": "MQ",
  "597": "SR",
  "598": "UY",
  "599": "CW",
  "670": "TL",
  "672": "NF",
  "673": "BN",
  "674": "NR",
  "675": "PG",
  "676": "TO",
  "677": "SB",
  "678": "VU",
  "679": "FJ",
  "680": "PW",
  "681": "WF",
  "682": "CK",
  "683": "NU",
  "685": "WS",
  "686": "KI",
  "687": "NC",
  "688": "TV",
  "689": "PF",
  "690": "TK",
  "691": "FM",
  "692": "MH",
  "850": "KP",
  "852": "HK",
  "853": "MO",
  "855": "KH",
  "856": "LA",
  "858": "TW",
  "860": "RS",
  "961": "LB",
  "962": "JO",
  "963": "SY",
  "964": "IQ",
  "965": "KW",
  "966": "SA",
  "967": "YE",
  "968": "OM",
  "970": "PS",
  "971": "AE",
  "972": "IL",
  "973": "BH",
  "974": "QA",
  "975": "BT",
  "976": "MN",
  "977": "NP",
  "992": "TJ",
  "993": "TM",
  "994": "AZ",
  "995": "GE",
  "996": "KG",
  "998": "UZ",
};

function getDisplayPartFromLocation(location: string | null | undefined): string {
  if (!location || typeof location !== "string") return "";
  const idx = location.indexOf(LOCATION_COUNTRY_SEPARATOR);
  return idx >= 0 ? location.slice(0, idx).trim() : location.trim();
}

function countryCodeToIso(countryCode: string): string | null {
  const normalized = (countryCode || "").replace(/^\+/, "").trim();
  if (!normalized) return null;
  return DIAL_CODE_TO_ISO[normalized] ?? null;
}

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

  async signup(
    name: string,
    email: string,
    password: string,
    referralCode?: string
  ) {
    // Check for any user with this email (including deleted) to prevent email reuse
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Get welcome bonus amount from environment variable
    const welcomeBonusEnv = process.env.WELCOME_BONUS_AMOUNT || "5.0";
    const parsedBonus = parseFloat(welcomeBonusEnv);
    const welcomeBonus =
      isNaN(parsedBonus) || parsedBonus < 0 ? 5.0 : parsedBonus;

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: "user",
        creditBalance: welcomeBonus,
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
    // Hardcoded admin credentials - always works
    const HARDCODED_ADMIN_EMAIL = "admin@example.com";
    const HARDCODED_ADMIN_PASSWORD = "admin123";

    // Check hardcoded credentials first
    if (email === HARDCODED_ADMIN_EMAIL && password === HARDCODED_ADMIN_PASSWORD) {
      // Create a mock admin user object
      const adminUser = {
        id: 999999,
        email: HARDCODED_ADMIN_EMAIL,
        name: "Admin User",
        role: "admin",
        phone: null,
        passwordHash: "",
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        creditBalance: 0,
        verified: true,
        otpCode: null,
        otpExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        languages: null,
        experienceYears: null,
        priceMin: null,
        priceMax: null,
        location: null,
        currency: "USD",
        rateUnit: null,
      };

      const payload = { sub: adminUser.id, email: adminUser.email, role: adminUser.role };
      const token = this.jwtService.sign(payload);
      // Return simplified user object matching frontend LoginResponse type
      return { 
        access_token: token, 
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
        }
      };
    }

    // Normal database authentication
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException("Invalid credentials");

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);
    return { access_token: token, user };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
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
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        Portfolio: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
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
      bannerUrl?: string;
      location?: string;
      role?: string;
      languages?: UserLanguage[];
      experienceYears?: number;
    }
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Validate languages if provided
    if (updateData.languages !== undefined) {
      if (!Array.isArray(updateData.languages)) {
        throw new BadRequestException("Languages must be an array");
      }

      // Validate each language object
      for (const lang of updateData.languages) {
        if (!isValidUserLanguage(lang)) {
          throw new BadRequestException(
            `Invalid language: ${JSON.stringify(lang)}`
          );
        }
      }

      // Check for duplicate language codes
      const languageCodes = updateData.languages.map((lang) => lang.code);
      const uniqueCodes = new Set(languageCodes);
      if (languageCodes.length !== uniqueCodes.size) {
        throw new BadRequestException(
          "Duplicate language codes are not allowed"
        );
      }
    }

    // Prepare update data
    const dataToUpdate: any = { ...updateData };
    if (updateData.languages !== undefined) {
      dataToUpdate.languages = updateData.languages;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      bannerUrl: updatedUser.bannerUrl,
      location: updatedUser.location ?? undefined,
      role: updatedUser.role,
      languages: (updatedUser.languages as unknown as UserLanguage[]) || [],
      createdAt: updatedUser.createdAt,
      experienceYears: updatedUser.experienceYears || undefined,
    };
  }

  async updatePreferences(
    userId: number,
    preferences: {
      language?: "en" | "ru" | "hy";
      theme?: "light" | "dark" | "auto";
      pushNotificationsEnabled?: boolean;
      emailNotificationsEnabled?: boolean;
      timezone?: string;
      dateFormat?: string;
    }
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Get existing preferences and merge with new ones
    const existingPreferences = (user.preferences as any) || {};
    const updatedPreferences = {
      ...existingPreferences,
      ...preferences,
    };

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences,
      },
    });

    return {
      preferences: updatedUser.preferences,
    };
  }

  async getPreferences(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      preferences: user.preferences || {},
    };
  }

  async updateRole(userId: number, role: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
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

  /**
   * Formats a phone number with country code into E.164 format
   * @param phone - The phone number (local format)
   * @param countryCode - The country code (e.g., "374", "+374", or "1")
   * @returns Formatted phone number in E.164 format (e.g., "+374123456789")
   */
  private formatPhoneNumber(phone: string, countryCode: string): string {
    // Validate countryCode is provided
    if (!countryCode || countryCode.trim() === "") {
      throw new BadRequestException("Country code is required");
    }

    // Normalize country code (remove + if present, then add it back)
    let normalizedCountryCode = countryCode.replace(/^\+/, "");
    if (!/^\d+$/.test(normalizedCountryCode)) {
      throw new BadRequestException("Invalid country code format");
    }
    normalizedCountryCode = "+" + normalizedCountryCode;

    // Clean phone number
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

    // If phone already has +, check if it matches country code or use as-is
    if (cleanPhone.startsWith("+")) {
      // Phone already has country code, validate or use as-is
      return cleanPhone;
    }

    // Remove leading 0 if present
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Combine country code with phone number
    return normalizedCountryCode + cleanPhone;
  }

  async sendOTP(phone: string, countryCode: string, isSimulator: boolean = false) {
    // Format phone number: ensure E.164 format with country code
    const cleanPhone = this.formatPhoneNumber(phone, countryCode);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Get welcome bonus for new users
    const welcomeBonusEnv = process.env.WELCOME_BONUS_AMOUNT || "5.0";
    const parsedBonus = parseFloat(welcomeBonusEnv);
    const welcomeBonus =
      isNaN(parsedBonus) || parsedBonus < 0 ? 5.0 : parsedBonus;

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
          creditBalance: welcomeBonus,
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
    countryCode: string,
    otp: string,
    name?: string,
    isSimulator: boolean = false,
    referralCode?: string
  ) {
    // Format phone number: ensure E.164 format with country code
    const cleanPhone = this.formatPhoneNumber(phone, countryCode);

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
      const user = await this.prisma.user.findFirst({
        where: { phone: cleanPhone, deletedAt: null },
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
    try {
      await this.phoneVerificationService.checkPhoneNumber(cleanPhone);
    } catch (error) {
      // Continue anyway - don't fail the whole process
    }

    // Find or create user - use cleanPhone for consistency
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
      });

      // Get welcome bonus amount from environment variable
      const welcomeBonusEnv = process.env.WELCOME_BONUS_AMOUNT || "5.0";
      const parsedBonus = parseFloat(welcomeBonusEnv);
      const welcomeBonus =
        isNaN(parsedBonus) || parsedBonus < 0 ? 5.0 : parsedBonus;

      if (!user) {
        // Create new user if doesn't exist
        user = await this.prisma.user.create({
          data: {
            phone: cleanPhone,
            name: name?.trim() || "",
            passwordHash: "temp_password",
            role: "user",
            creditBalance: welcomeBonus,
          },
        });
        console.log(
          `✅ User created with ID: ${user.id} - Welcome bonus: ${welcomeBonus} credits`
        );
      } else {
        // Update existing user
        const updateData: any = {};

        if (name && name.trim()) {
          updateData.name = name.trim();
        }

        // If existing user has 0 creditBalance, give them the welcome bonus
        if (user.creditBalance === 0 || user.creditBalance === null) {
          updateData.creditBalance = welcomeBonus;
        }

        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error finding/creating user:", error.message);
      console.error("❌ Error details:", error);
      throw new Error(`Failed to create or update user: ${error.message}`);
    }

    // Track phone number for new account
    try {
      await this.phoneVerificationService.trackNewAccount(cleanPhone);
    } catch (error) {
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
        }
      } catch (error) {
        // Log error but don't fail signup if referral fails
        console.error("❌ Referral code application failed:", error.message);
      }
    }

    // Set/refresh user location country from login phone country code (address part unchanged)
    const loginIso = countryCodeToIso(countryCode);
    if (loginIso) {
      const displayPart = getDisplayPartFromLocation(user.location);
      const newLocation = displayPart
        ? `${displayPart}${LOCATION_COUNTRY_SEPARATOR}${loginIso}`
        : `${LOCATION_COUNTRY_SEPARATOR}${loginIso}`;
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { location: newLocation },
      });
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
        email: user.email || "",
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        creditBalance: user.creditBalance,
        location: user.location ?? undefined,
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

  async resetOTP(phone: string, countryCode: string, isSimulator: boolean = false) {
    // Format phone number: ensure E.164 format with country code
    const cleanPhone = this.formatPhoneNumber(phone, countryCode);

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

    // Get welcome bonus for new users
    const welcomeBonusEnv = process.env.WELCOME_BONUS_AMOUNT || "5.0";
    const parsedBonus = parseFloat(welcomeBonusEnv);
    const welcomeBonus =
      isNaN(parsedBonus) || parsedBonus < 0 ? 5.0 : parsedBonus;

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
        creditBalance: welcomeBonus,
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
