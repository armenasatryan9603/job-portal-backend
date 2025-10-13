import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuthModule } from '../auth/auth.module'; // needed for JwtAuthGuard
import { MediaFilesModule } from '../media-files/media-files.module';

@Module({
  imports: [AuthModule, MediaFilesModule], // so we can use JwtAuthGuard and MediaFilesService
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class OrdersModule {}
