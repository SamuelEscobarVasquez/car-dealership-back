import { Injectable } from '@nestjs/common';
import { NodeHandler, ConversationState, NodeResult } from './types';
import { OpenAIService } from '../services/openai.service';
import { FaqRepository } from '../services/faq.repository';
import { AutosRepository } from '../services/autos.repository';
import { DatesRepository } from '../services/dates.repository';

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
        useCase: result.useCase,
        confidence: result.confidence,
        requiresValidation: result.requiresValidation,
      },
      nextRoute: result.requiresValidation ? 'validator' : result.route,
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
    // Find the answer from previous nodes in priority order
    let finalAnswer = '';

    if (state.vars['validator.required_fields']?.questionsToAsk) {
      finalAnswer = state.vars['validator.required_fields'].questionsToAsk;
    } else if (state.vars['autos.specialist.openai']?.answer) {
      finalAnswer = state.vars['autos.specialist.openai'].answer;
    } else if (state.vars['dates.specialist.openai']?.answer) {
      finalAnswer = state.vars['dates.specialist.openai'].answer;
    } else if (state.vars['faq.specialist.openai']?.answer) {
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

export interface ValidationRule {
  field: string;
  orFields?: string[];
  required?: boolean;
  requiredWhenContains?: string[];
  label: string;
}

export interface UseCaseValidationConfig {
  extract: 'dates' | 'autos' | 'consultation' | 'none';
  rules: ValidationRule[];
}

export interface ValidatorConfig {
  useCases: Record<string, UseCaseValidationConfig>;
}

@Injectable()
export class ValidatorNode implements NodeHandler {
  type = 'validator.required_fields';

  constructor(private openaiService: OpenAIService) {}

  private getDefaultConfig(): ValidatorConfig {
    return {
      useCases: {
        dates: {
          extract: 'dates',
          rules: [
            {
              field: 'date',
              orFields: ['dayOfWeek'],
              required: true,
              label: 'fecha o día de la semana',
            },
          ],
        },
        autos: {
          extract: 'autos',
          rules: [
            {
              field: 'maxPrice',
              orFields: ['minPrice'],
              required: false,
              requiredWhenContains: ['barato', 'económico', 'caro', 'lujoso', 'costoso'],
              label: 'rango de precio',
            },
          ],
        },
        faq: {
          extract: 'none',
          rules: [],
        },
        generic: {
          extract: 'none',
          rules: [],
        },
      },
    };
  }

  private mergeConfig(config: Record<string, any>): ValidatorConfig {
    const defaultConfig = this.getDefaultConfig();
    
    if (!config.useCases) {
      return defaultConfig;
    }

    // Merge user config with defaults
    return {
      useCases: {
        ...defaultConfig.useCases,
        ...config.useCases,
      },
    };
  }

  private checkRules(
    rules: ValidationRule[],
    collected: Record<string, any>,
    userMessage: string,
  ): string[] {
    const missingFields: string[] = [];
    const messageLower = userMessage.toLowerCase();

    for (const rule of rules) {
      // Check if this rule applies
      let shouldValidate = rule.required === true;

      // Check conditional requirement (when message contains certain words)
      if (rule.requiredWhenContains && rule.requiredWhenContains.length > 0) {
        const containsTrigger = rule.requiredWhenContains.some((term) =>
          messageLower.includes(term.toLowerCase()),
        );
        if (containsTrigger) {
          shouldValidate = true;
        }
      }

      if (!shouldValidate) continue;

      // Check if field or any orField is present
      const hasMainField = collected[rule.field] !== undefined && collected[rule.field] !== null;
      const hasOrField = rule.orFields?.some(
        (f) => collected[f] !== undefined && collected[f] !== null,
      );

      if (!hasMainField && !hasOrField) {
        missingFields.push(rule.label);
      }
    }

    return missingFields;
  }

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const useCase = state.vars['orchestrator.openai']?.useCase || 'generic';
    const validatorConfig = this.mergeConfig(config);
    const useCaseConfig = validatorConfig.useCases[useCase];

    // If no config for this useCase, pass through
    if (!useCaseConfig) {
      return {
        output: {
          ready: true,
          missingFields: [],
          questionsToAsk: '',
          collected: {},
          useCase,
        },
        nextRoute: useCase,
      };
    }

    // Extract data based on useCase type
    let collected: Record<string, any> = {};

    if (useCaseConfig.extract === 'dates') {
      collected = await this.openaiService.extractDatesEntities(
        state.userMessage,
        state.context,
      );
    } else if (useCaseConfig.extract === 'autos') {
      collected = await this.openaiService.extractAutosFilters(
        state.userMessage,
        state.context,
      );
    } else if (useCaseConfig.extract === 'consultation') {
      collected = await this.openaiService.extractConsultationEntities(
        state.userMessage,
        state.context,
      );
    }

    // Validate rules
    const missingFields = this.checkRules(
      useCaseConfig.rules,
      collected,
      state.userMessage,
    );

    const ready = missingFields.length === 0;

    // Generate questions if not ready
    let questionsToAsk = '';
    if (!ready) {
      questionsToAsk = await this.openaiService.generateValidatorQuestions(
        useCase,
        missingFields,
        collected,
        state.context,
      );
    }

    return {
      output: {
        ready,
        missingFields,
        questionsToAsk,
        collected,
        useCase,
        appliedRules: useCaseConfig.rules.map((r) => r.label),
      },
      nextRoute: ready ? useCase : undefined,
    };
  }
}

@Injectable()
export class AutosSpecialistNode implements NodeHandler {
  type = 'autos.specialist.openai';

  constructor(
    private openaiService: OpenAIService,
    private autosRepository: AutosRepository,
  ) {}

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const maxResults = config.maxResults || 5;

    // Get filters from validator or extract them
    let filters = state.vars['validator.required_fields']?.collected || {};
    
    if (Object.keys(filters).length === 0) {
      filters = await this.openaiService.extractAutosFilters(
        state.userMessage,
        state.context,
      );
    }

    // Search in repository
    const vehicles = this.autosRepository.search(filters, maxResults);

    // Generate answer with LLM
    const answer = await this.openaiService.generateAutosAnswer(
      state.userMessage,
      vehicles,
      filters,
      state.context,
    );

    return {
      output: {
        answer,
        extractedFilters: filters,
        itemsFound: vehicles.map((v) => ({
          marca: v.Marca,
          modelo: v.Modelo,
          año: v.Año,
          precio: v.Precio,
        })),
        count: vehicles.length,
      },
    };
  }
}

@Injectable()
export class DatesSpecialistNode implements NodeHandler {
  type = 'dates.specialist.openai';

  constructor(
    private openaiService: OpenAIService,
    private datesRepository: DatesRepository,
  ) {}

  async run(state: ConversationState, config: Record<string, any>): Promise<NodeResult> {
    const maxSlots = config.maxSlots || 5;

    // Get entities from validator or extract them
    let entities = state.vars['validator.required_fields']?.collected || {};
    
    if (Object.keys(entities).length === 0) {
      entities = await this.openaiService.extractDatesEntities(
        state.userMessage,
        state.context,
      );
    }

    // Search available slots
    const availableSlots = this.datesRepository.search(entities, maxSlots);

    // Generate answer with LLM
    const answer = await this.openaiService.generateDatesAnswer(
      state.userMessage,
      availableSlots,
      entities,
      state.context,
    );

    return {
      output: {
        answer,
        extractedEntities: entities,
        availableSlots,
        count: availableSlots.length,
      },
    };
  }
}
