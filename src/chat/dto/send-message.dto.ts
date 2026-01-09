import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
} from "class-validator";

export class SendMessageDto {
  @IsNumber()
  conversationId: number;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(["text", "image", "file", "system"])
  messageType?: "text" | "image" | "file" | "system";

  @IsOptional()
  @IsObject()
  metadata?: any;
}
