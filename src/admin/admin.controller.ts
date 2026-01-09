import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      search,
      role,
    );
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Post('users/:id/notifications')
  async sendNotification(
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: SendNotificationDto,
  ) {
    return this.adminService.sendNotification(userId, dto);
  }

  @Post('users/:id/messages')
  async sendMessage(
    @Request() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: SendMessageDto,
  ) {
    const adminUserId = req.user.userId;
    return this.adminService.sendMessage(adminUserId, userId, dto);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }
}
