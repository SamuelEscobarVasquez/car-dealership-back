import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from '../../dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async findAll() {
    return this.chatService.findAll();
  }

  @Post(':conversationId/message')
  async sendMessage(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(conversationId, dto);
  }

  @Get(':conversationId/history')
  async getHistory(@Param('conversationId', ParseUUIDPipe) conversationId: string) {
    return this.chatService.getHistory(conversationId);
  }

  @Delete(':conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    await this.chatService.deleteConversation(conversationId);
  }
}
