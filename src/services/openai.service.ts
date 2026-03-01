import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private client: OpenAI;
  private model: string = 'gpt-4o-mini';
  private requestCount: number = 0;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.logger.log(`Initialized with model: ${this.model}`);
  }

  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json_object';
    },
  ): Promise<LLMResponse> {
    this.requestCount++;
    const requestId = this.requestCount;

    this.logger.log(`\n========== OPENAI REQUEST #${requestId} ==========`);
    this.logger.log(`Model: ${this.model}`);
    this.logger.log(`Options: ${JSON.stringify(options)}`);
    this.logger.log(`Messages count: ${messages.length}`);

    messages.forEach((msg, idx) => {
      const preview = msg.content.substring(0, 200);
      this.logger.log(`  [${idx}] ${msg.role}: ${preview}${msg.content.length > 200 ? '...' : ''}`);
    });

    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000,
      response_format:
        options?.responseFormat === 'json_object'
          ? { type: 'json_object' }
          : undefined,
    });

    const elapsed = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';

    this.logger.log(`Response received in ${elapsed}ms`);
    this.logger.log(`Response preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    this.logger.log(`========== END OPENAI REQUEST #${requestId} ==========\n`);

    return {
      content,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async orchestrate(
    userMessage: string,
    context?: string[],
  ): Promise<{ route: string; confidence: number }> {
    const systemPrompt = `Eres un orquestador que clasifica la intención del usuario.
Analiza el mensaje y responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "route": "faq" | "generic",
  "confidence": number (0-1)
}

- "faq": preguntas sobre la agencia de autos, vehículos, financiamiento, servicios, etc.
- "generic": saludos, despedidas, preguntas no relacionadas.

Contexto previo de la conversación:
${context?.join('\n') || 'Sin contexto previo'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.3, responseFormat: 'json_object' },
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return { route: 'generic', confidence: 0.5 };
    }
  }

  async generateFaqAnswer(
    userMessage: string,
    relevantFaqs: Array<{ pregunta: string; respuesta: string }>,
    context?: string[],
  ): Promise<string> {
    const faqContext = relevantFaqs
      .map((faq) => `P: ${faq.pregunta}\nR: ${faq.respuesta}`)
      .join('\n\n');

    const systemPrompt = `Eres un asistente virtual de una agencia de autos. Responde de manera amigable y profesional.

Usa la siguiente información de FAQ para responder:
${faqContext}

Si la pregunta no está cubierta por las FAQs, indica amablemente que pueden contactar a un asesor.

Contexto de la conversación:
${context?.join('\n') || 'Sin contexto previo'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.7 },
    );

    return response.content;
  }

  async generateGenericResponse(
    userMessage: string,
    context?: string[],
  ): Promise<string> {
    const systemPrompt = `Eres un asistente virtual de una agencia de autos. 
Responde de manera cordial y redirige la conversación hacia temas de la agencia si es posible.

Contexto de la conversación:
${context?.join('\n') || 'Sin contexto previo'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.8 },
    );

    return response.content;
  }
}
