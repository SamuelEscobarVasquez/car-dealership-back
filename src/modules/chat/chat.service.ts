import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Turn } from '../../entities/turn.entity';
import { FlowService } from '../flow/flow.service';
import { FlowRunnerService } from '../../engine/flow-runner.service';
import { SendMessageDto, ChatResponseDto } from '../../dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Turn)
    private turnRepository: Repository<Turn>,
    private flowService: FlowService,
    private flowRunnerService: FlowRunnerService,
  ) {}

  async findAll(): Promise<Conversation[]> {
    return this.conversationRepository.find({
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async getOrCreateConversation(conversationId: string): Promise<Conversation> {
    let conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['turns'],
    });

    if (!conversation) {
      const activeFlow = await this.flowService.findActive();
      if (!activeFlow) {
        throw new NotFoundException('No active flow found. Please activate a flow first.');
      }

      conversation = this.conversationRepository.create({
        id: conversationId,
        flowId: activeFlow.id,
        turns: [],
      });
      await this.conversationRepository.save(conversation);
    }

    return conversation;
  }

  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    const conversation = await this.getOrCreateConversation(conversationId);

    // Save user turn
    const userTurn = this.turnRepository.create({
      conversationId,
      role: 'user',
      content: dto.message,
    });
    await this.turnRepository.save(userTurn);

    // Get conversation context
    const turns = await this.turnRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: 20, // Last 20 turns
    });

    const context = turns.map((t) => `${t.role}: ${t.content}`);

    // Get active flow and run it
    const activeFlow = await this.flowService.findActive();
    if (!activeFlow) {
      throw new NotFoundException('No active flow found');
    }

    this.logger.debug(`Running flow: ${activeFlow.name}`);
    const response = await this.flowRunnerService.runFlow(
      activeFlow.definition,
      dto.message,
      context,
    );

    // Save assistant turn
    const assistantTurn = this.turnRepository.create({
      conversationId,
      role: 'assistant',
      content: response,
    });
    await this.turnRepository.save(assistantTurn);

    return {
      conversationId,
      message: response,
      timestamp: assistantTurn.createdAt,
    };
  }

  async getHistory(conversationId: string): Promise<Turn[]> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    return this.turnRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    await this.turnRepository.delete({ conversationId });
    await this.conversationRepository.remove(conversation);
  }
}
