import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  /**
   * Create a new conversation
   */
  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  async createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    const userId = req.user.userId;
    return this.chatService.createConversation(userId, dto);
  }

  /**
   * Get user's conversations
   */
  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getUserConversations(
    @Request() req,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    const userId = req.user.userId;
    return this.chatService.getUserConversations(userId, page, limit);
  }

  /**
   * Get specific conversation
   */
  @Get('conversations/:id')
  async getConversation(@Param('id', ParseIntPipe) conversationId: number) {
    return this.chatService.getConversationById(conversationId);
  }

  /**
   * Get messages for a conversation
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', ParseIntPipe) conversationId: number,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    return this.chatService.getMessages(conversationId, page, limit);
  }

  /**
   * Send a message
   */
  @Post('messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Request() req, @Body() dto: SendMessageDto) {
    const userId = req.user.userId;
    return this.chatService.sendMessage(userId, dto);
  }

  /**
   * Mark messages as read
   */
  @Post('conversations/:id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Request() req,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.markMessagesAsRead(userId, conversationId);
  }

  /**
   * Get unread message count
   */
  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req) {
    const userId = req.user.userId;
    const count = await this.chatService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  /**
   * Create conversation for order
   */
  @Post('orders/:orderId/conversation')
  @UseGuards(JwtAuthGuard)
  async createOrderConversation(
    @Request() req,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.createOrderConversation(orderId, userId);
  }

  /**
   * Get conversation participants
   */
  @Get('conversations/:id/participants')
  @UseGuards(JwtAuthGuard)
  async getParticipants(
    @Request() req,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.getConversationParticipants(conversationId, userId);
  }

  /**
   * Reject application and refund credit
   */
  @Post('orders/:orderId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectApplication(
    @Request() req,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.rejectApplication(orderId, userId);
  }

  /**
   * Choose application
   */
  @Post('orders/:orderId/choose')
  @UseGuards(JwtAuthGuard)
  async chooseApplication(
    @Request() req,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.chooseApplication(orderId, userId);
  }

  /**
   * Leave a conversation
   */
  @Post('conversations/:conversationId/leave')
  @UseGuards(JwtAuthGuard)
  async leaveConversation(
    @Request() req,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.leaveConversation(conversationId, userId);
  }

  /**
   * Cancel chosen application and reopen order
   */
  @Post('orders/:orderId/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelApplication(
    @Request() req,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.cancelApplication(orderId, userId);
  }

  /**
   * Complete order and close conversation
   */
  @Post('orders/:orderId/complete')
  @UseGuards(JwtAuthGuard)
  async completeOrder(
    @Request() req,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.completeOrder(orderId, userId);
  }
}
