import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation, Turn } from '../../entities';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { FlowModule } from '../flow/flow.module';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Turn]),
    forwardRef(() => FlowModule),
    forwardRef(() => EngineModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
