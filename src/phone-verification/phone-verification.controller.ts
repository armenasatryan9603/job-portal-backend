import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';

@Controller('phone-verification')
export class PhoneVerificationController {
  constructor(
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  @Get('check/:phoneNumber')
  async checkPhoneNumber(@Param('phoneNumber') phoneNumber: string) {
    try {
      const result =
        await this.phoneVerificationService.checkPhoneNumber(phoneNumber);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error checking phone number:', error);
      return {
        success: false,
        message: 'Failed to check phone number',
      };
    }
  }

  @Post('track')
  async trackNewAccount(@Body() body: { phoneNumber: string }) {
    try {
      await this.phoneVerificationService.trackNewAccount(body.phoneNumber);

      return {
        success: true,
        message: 'Phone number tracked successfully',
      };
    } catch (error) {
      console.error('Error tracking phone number:', error);
      return {
        success: false,
        message: 'Failed to track phone number',
      };
    }
  }

  @Get('history/:phoneNumber')
  async getPhoneHistory(@Param('phoneNumber') phoneNumber: string) {
    try {
      const history =
        await this.phoneVerificationService.getPhoneHistory(phoneNumber);

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('Error getting phone history:', error);
      return {
        success: false,
        message: 'Failed to get phone history',
      };
    }
  }
}

