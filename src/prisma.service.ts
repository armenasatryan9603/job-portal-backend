import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Global,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Global()
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static isConnected = false;

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    // Only connect once
    if (!PrismaService.isConnected) {
      try {
        console.log('PrismaService: Connecting to database...');
        await this.$connect();
        PrismaService.isConnected = true;
        console.log('PrismaService: Connected to database successfully');
      } catch (error) {
        console.error('PrismaService: Failed to connect to database:', error);
        throw error;
      }
    } else {
      console.log('PrismaService: Already connected to database');
    }
  }

  async onModuleDestroy() {
    if (PrismaService.isConnected) {
      console.log('PrismaService: Disconnecting from database...');
      await this.$disconnect();
      PrismaService.isConnected = false;
      console.log('PrismaService: Disconnected from database');
    }
  }
}
