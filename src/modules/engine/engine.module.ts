import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Flow } from '../../entities/flow.entity';
import { OpenAIService, FaqRepository, AutosRepository, DatesRepository } from '../../services';
import {
  OrchestratorNode,
  FaqSpecialistNode,
  GenericResponseNode,
  MemoryLoadNode,
  ResponseComposeNode,
  ValidatorNode,
  AutosSpecialistNode,
  DatesSpecialistNode,
} from '../../engine/nodes';
import { NodeRegistry } from '../../engine/node-registry';
import { FlowRunnerService } from '../../engine/flow-runner.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Flow]),
  ],
  providers: [
    OpenAIService,
    FaqRepository,
    AutosRepository,
    DatesRepository,
    OrchestratorNode,
    FaqSpecialistNode,
    GenericResponseNode,
    MemoryLoadNode,
    ResponseComposeNode,
    ValidatorNode,
    AutosSpecialistNode,
    DatesSpecialistNode,
    NodeRegistry,
    FlowRunnerService,
  ],
  exports: [
    OpenAIService,
    FaqRepository,
    AutosRepository,
    DatesRepository,
    NodeRegistry,
    FlowRunnerService,
  ],
})
export class EngineModule {}
