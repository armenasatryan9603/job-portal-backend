import {
  Controller,
  Get,
  Post,
  Delete,
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
import { PusherService } from './pusher.service';

@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private pusherService: PusherService,
  ) {}

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
   * Delete a conversation (mark as removed)
   */
  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard)
  async deleteConversation(
    @Request() req,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.deleteConversation(userId, conversationId);
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

  /**
   * Get Pusher configuration (public key and cluster)
   */
  @Get('pusher/config')
  async getPusherConfig() {
    return {
      key: process.env.PUSHER_KEY || '',
      cluster: process.env.PUSHER_CLUSTER || 'eu',
    };
  }

  /**
   * Authenticate Pusher channel subscription
   */
  @Post('pusher/auth')
  @UseGuards(JwtAuthGuard)
  async authenticatePusher(
    @Request() req,
    @Body() body: { socket_id: string; channel_name: string },
  ) {
    const userId = req.user.userId;
    const { socket_id, channel_name } = body;

    // Validate channel name format (e.g., "private-conversation-123" or "conversation-123")
    if (
      channel_name.startsWith('private-conversation-') ||
      channel_name.startsWith('conversation-')
    ) {
      const conversationId = parseInt(
        channel_name.replace('private-conversation-', '').replace('conversation-', ''),
      );

      // Verify user is participant
      const participants = await this.chatService.getConversationParticipants(
        conversationId,
        userId,
      );

      if (!participants || participants.length === 0) {
        throw new Error('Not authorized for this channel');
      }
    }

    return this.pusherService.authenticate(socket_id, channel_name, userId);
  }
}
