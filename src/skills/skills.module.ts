import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService, PrismaService],
  exports: [SkillsService],
})
export class SkillsModule {}

