import { Injectable } from '@nestjs/common';
import { NodeHandler } from './types';
import {
  OrchestratorNode,
  FaqSpecialistNode,
  GenericResponseNode,
  MemoryLoadNode,
  ResponseComposeNode,
} from './nodes';

@Injectable()
export class NodeRegistry {
  private handlers: Map<string, NodeHandler> = new Map();

  constructor(
    private orchestratorNode: OrchestratorNode,
    private faqSpecialistNode: FaqSpecialistNode,
    private genericResponseNode: GenericResponseNode,
    private memoryLoadNode: MemoryLoadNode,
    private responseComposeNode: ResponseComposeNode,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(this.orchestratorNode);
    this.register(this.faqSpecialistNode);
    this.register(this.genericResponseNode);
    this.register(this.memoryLoadNode);
    this.register(this.responseComposeNode);
  }

  register(handler: NodeHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  getAvailableTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
