import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MediaFilesController } from './media-files.controller';
import { MediaFilesService } from './media-files.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MediaFilesController],
  providers: [MediaFilesService, PrismaService],
  exports: [MediaFilesService],
})
export class MediaFilesModule {}
