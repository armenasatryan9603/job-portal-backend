import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  type?: string;
}
