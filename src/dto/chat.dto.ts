import { IsString, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatResponseDto {
  conversationId: string;
  message: string;
  timestamp: Date;
}
