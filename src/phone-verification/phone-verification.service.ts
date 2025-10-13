import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class PhoneVerificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Hash phone number for privacy
   */
  private hashPhoneNumber(phoneNumber: string): string {
    return createHash('sha256').update(phoneNumber).digest('hex');
  }

  /**
   * Check if phone number has been used before and if user is eligible for credits
   */
  async checkPhoneNumber(phoneNumber: string): Promise<{
    hasSignedUpBefore: boolean;
    lastSignupDate?: Date;
    creditsEligible: boolean;
  }> {
    const phoneHash = this.hashPhoneNumber(phoneNumber);

    const existing = await this.prisma.phoneVerification.findUnique({
      where: { phoneHash: phoneHash },
    });

    if (!existing) {
      // New user - eligible for credits
      return {
        hasSignedUpBefore: false,
        creditsEligible: true,
      };
    }

    // Check if enough time has passed for credits (e.g., 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const creditsEligible = existing.lastSignupAt < thirtyDaysAgo;

    return {
      hasSignedUpBefore: true,
      lastSignupDate: existing.lastSignupAt,
      creditsEligible,
    };
  }

  /**
   * Track phone number for new account registration
   */
  async trackNewAccount(phoneNumber: string): Promise<void> {
    const phoneHash = this.hashPhoneNumber(phoneNumber);
    const now = new Date();

    const existing = await this.prisma.phoneVerification.findUnique({
      where: { phoneHash: phoneHash },
    });

    if (existing) {
      // Update existing record
      await this.prisma.phoneVerification.update({
        where: { phoneHash: phoneHash },
        data: {
          lastSignupAt: now,
          signupCount: existing.signupCount + 1,
        },
      });
    } else {
      // Create new record
      await this.prisma.phoneVerification.create({
        data: {
          phoneHash: phoneHash,
          firstSignupAt: now,
          lastSignupAt: now,
          signupCount: 1,
        },
      });
    }
  }

  /**
   * Get phone number history (for debugging)
   */
  async getPhoneHistory(phoneNumber: string): Promise<any> {
    const phoneHash = this.hashPhoneNumber(phoneNumber);

    const record = await this.prisma.phoneVerification.findUnique({
      where: { phoneHash: phoneHash },
    });

    return record
      ? {
          firstSignup: record.firstSignupAt,
          lastSignup: record.lastSignupAt,
          signupCount: record.signupCount,
        }
      : null;
  }
}
