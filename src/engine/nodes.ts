import { Injectable } from '@nestjs/common';
import { NodeHandler, ConversationState, NodeResult } from './types';
import { OpenAIService } from '../services/openai.service';
import { FaqRepository } from '../services/faq.repository';

@Injectable()
export class OrchestratorNode implements NodeHandler {
  type = 'orchestrator.openai';

  constructor(private openaiService: OpenAIService) {}

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const result = await this.openaiService.orchestrate(
      state.userMessage,
      state.context,
    );

    return {
      output: {
        route: result.route,
        confidence: result.confidence,
      },
      nextRoute: result.route,
    };
  }
}

@Injectable()
export class FaqSpecialistNode implements NodeHandler {
  type = 'faq.specialist.openai';

  constructor(
    private openaiService: OpenAIService,
    private faqRepository: FaqRepository,
  ) {}

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const topK = config.topK || 5;
    const relevantFaqs = this.faqRepository.searchFaqs(state.userMessage, topK);

    const answer = await this.openaiService.generateFaqAnswer(
      state.userMessage,
      relevantFaqs,
      state.context,
    );

    return {
      output: {
        faqs: relevantFaqs,
        answer,
      },
    };
  }
}

@Injectable()
export class GenericResponseNode implements NodeHandler {
  type = 'generic.response.openai';

  constructor(private openaiService: OpenAIService) {}

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const answer = await this.openaiService.generateGenericResponse(
      state.userMessage,
      state.context,
    );

    return {
      output: {
        answer,
      },
    };
  }
}

@Injectable()
export class MemoryLoadNode implements NodeHandler {
  type = 'memory.load';

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    // Memory is already loaded in state.context by the ChatService
    const maxTurns = config.maxTurns || 10;
    const truncatedContext = state.context.slice(-maxTurns);

    return {
      output: {
        context: truncatedContext,
        turnCount: truncatedContext.length,
      },
    };
  }
}

@Injectable()
export class ResponseComposeNode implements NodeHandler {
  type = 'response.compose';

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    // Find the answer from previous nodes
    let finalAnswer = '';

    if (state.vars['faq.specialist.openai']?.answer) {
      finalAnswer = state.vars['faq.specialist.openai'].answer;
    } else if (state.vars['generic.response.openai']?.answer) {
      finalAnswer = state.vars['generic.response.openai'].answer;
    } else {
      finalAnswer = 'Lo siento, no pude procesar tu solicitud. ¿Puedo ayudarte con algo más?';
    }

    return {
      output: {
        finalAnswer,
      },
    };
  }
}
