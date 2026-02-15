import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { PhoneVerificationModule } from "../phone-verification/phone-verification.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "yourSecretKey",
      signOptions: { expiresIn: "30d" }, // Extended to 30 days for longer sessions
    }),
    PhoneVerificationModule,
    NotificationsModule,
    ReferralsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
