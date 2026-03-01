import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flow, FlowDefinition, FlowNode, FlowEdge } from '../entities/flow.entity';
import { NodeRegistry } from './node-registry';
import { ConversationState, NodeResult } from './types';

@Injectable()
export class FlowRunnerService {
  private readonly logger = new Logger(FlowRunnerService.name);

  constructor(
    @InjectRepository(Flow)
    private flowRepository: Repository<Flow>,
    private nodeRegistry: NodeRegistry,
  ) {}

  async getActiveFlow(): Promise<Flow | null> {
    return this.flowRepository.findOne({ where: { isActive: true } });
  }

  async runFlow(
    flowDefinition: FlowDefinition,
    userMessage: string,
    context: string[] = [],
  ): Promise<string> {
    const state: ConversationState = {
      userMessage,
      vars: {},
      context,
      finalAnswer: null,
    };

    const { startNodeId, nodes, edges } = flowDefinition;
    let currentNodeId: string | null = startNodeId;
    const maxIterations = 20; // Safety limit
    let iterations = 0;

    while (currentNodeId && iterations < maxIterations) {
      iterations++;
      const node = nodes.find((n) => n.id === currentNodeId);

      if (!node) {
        this.logger.warn(`Node ${currentNodeId} not found in flow`);
        break;
      }

      const handler = this.nodeRegistry.get(node.type);
      if (!handler) {
        this.logger.warn(`Handler for node type ${node.type} not found`);
        break;
      }

      this.logger.debug(`Executing node: ${node.id} (${node.type})`);

      try {
        const result: NodeResult = await handler.run(state, node.data.config || {});
        
        // Store output in vars using node type as key
        state.vars[node.type] = result.output;

        // Check if this is a response node (terminal)
        if (node.type === 'response.compose') {
          state.finalAnswer = result.output.finalAnswer;
          break;
        }

        // Find next node based on edges
        currentNodeId = this.findNextNode(edges, node.id, result.nextRoute);
      } catch (error) {
        this.logger.error(`Error executing node ${node.id}: ${error.message}`);
        state.finalAnswer = 'Ocurrió un error procesando tu solicitud. Por favor intenta de nuevo.';
        break;
      }
    }

    if (!state.finalAnswer) {
      state.finalAnswer = 'No pude completar el procesamiento. ¿Puedo ayudarte con algo más?';
    }

    return state.finalAnswer;
  }

  private findNextNode(
    edges: FlowEdge[],
    currentNodeId: string,
    route?: string,
  ): string | null {
    // Find edges from current node
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      return null;
    }

    // If there's a route, look for conditional edge
    if (route) {
      const conditionalEdge = outgoingEdges.find(
        (e) => e.data?.condition === route,
      );
      if (conditionalEdge) {
        return conditionalEdge.target;
      }
    }

    // Return first edge without condition, or first edge overall
    const defaultEdge = outgoingEdges.find((e) => !e.data?.condition) || outgoingEdges[0];
    return defaultEdge?.target || null;
  }
}
