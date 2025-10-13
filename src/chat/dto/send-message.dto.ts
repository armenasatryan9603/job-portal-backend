export class SendMessageDto {
  conversationId: number;
  content: string;
  messageType?: 'text' | 'image' | 'file' | 'system';
  metadata?: any;
}
