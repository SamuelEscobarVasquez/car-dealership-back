import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

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
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string = 'gemini-2.5-flash-preview-05-20';
  private requestCount: number = 0;

  constructor(private configService: ConfigService) {
    this.client = new GoogleGenerativeAI(
      this.configService.get<string>('GEMINI_API_KEY') || '',
    );
    this.model = this.client.getGenerativeModel({ model: this.modelName });
    this.logger.log(`Initialized with model: ${this.modelName}`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 5000,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.warn(`Rate limit hit, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
    throw lastError;
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
    
    this.logger.log(`\n========== GEMINI REQUEST #${requestId} ==========`);
    this.logger.log(`Model: ${this.modelName}`);

    return this.withRetry(async () => {
      const systemMessage = messages.find((m) => m.role === 'system');
      const chatMessages = messages.filter((m) => m.role !== 'system');

      const history = chatMessages.slice(0, -1).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = chatMessages[chatMessages.length - 1];
      
      const startTime = Date.now();
      
      const modelWithConfig = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemMessage?.content,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 1000,
          responseMimeType: options?.responseFormat === 'json_object' ? 'application/json' : 'text/plain',
        },
      });

      const chat = modelWithConfig.startChat({ history });
      const result = await chat.sendMessage(lastMessage?.content || '');
      const response = result.response;
      
      const elapsed = Date.now() - startTime;
      this.logger.log(`Response received in ${elapsed}ms`);
      this.logger.log(`========== END GEMINI REQUEST #${requestId} ==========\n`);

      return {
        content: response.text(),
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount || 0,
              completionTokens: response.usageMetadata.candidatesTokenCount || 0,
              totalTokens: response.usageMetadata.totalTokenCount || 0,
            }
          : undefined,
      };
    });
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
