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
  ): Promise<{ route: string; useCase: string; confidence: number; requiresValidation: boolean }> {
    const systemPrompt = `Eres un orquestador que clasifica la intención del usuario para una agencia de autos.
Analiza el mensaje y responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "route": "faq" | "autos" | "dates" | "generic",
  "useCase": "faq" | "autos" | "dates" | "generic",
  "confidence": number (0-1),
  "requiresValidation": boolean
}

Casos de uso:
- "autos": preguntas sobre vehículos disponibles, catálogo, precios, modelos, marcas, SUV, sedán, etc.
- "dates": preguntas sobre citas, disponibilidad de horarios, agendar, agenda, cuando puedo ir, etc.
- "faq": preguntas generales sobre la agencia, financiamiento, garantías, servicios, ubicación, etc.
- "generic": saludos, despedidas, preguntas no relacionadas con la agencia.

requiresValidation debe ser true cuando:
- Para "dates": si el usuario no especifica fecha concreta o día de la semana
- Para "autos": si el usuario dice "barato" sin especificar precio o usa términos vagos

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
      const result = JSON.parse(response.content);
      return {
        route: result.route || 'generic',
        useCase: result.useCase || result.route || 'generic',
        confidence: result.confidence || 0.5,
        requiresValidation: result.requiresValidation || false,
      };
    } catch {
      return { route: 'generic', useCase: 'generic', confidence: 0.5, requiresValidation: false };
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

  async extractAutosFilters(
    userMessage: string,
    context?: string[],
  ): Promise<{
    budget?: number;
    maxPrice?: number;
    minPrice?: number;
    condition?: string;
    employeeDiscount?: boolean;
    segment?: string;
    brand?: string;
    model?: string;
    year?: number;
  }> {
    const systemPrompt = `Extrae los filtros de búsqueda de autos del mensaje del usuario.
Responde ÚNICAMENTE con un JSON válido con los campos que puedas extraer:
{
  "budget": number o null (presupuesto aproximado en GTQ - Quetzales guatemaltecos),
  "maxPrice": number o null (precio máximo en GTQ),
  "minPrice": number o null (precio mínimo en GTQ),
  "condition": string o null ("nuevo" o "usado"),
  "employeeDiscount": boolean o null (si menciona descuento de empleado),
  "segment": string o null (SUV, Sedán, Pickup, Hatchback, etc.),
  "brand": string o null (marca: Toyota, Honda, Nissan, etc.),
  "model": string o null (modelo específico),
  "year": number o null (año específico)
}

Reglas:
- Si dice "barato" sin número, pon maxPrice: 150000 (GTQ)
- Si dice "económico", maxPrice: 200000 (GTQ)
- Si dice "de lujo" o "caro", minPrice: 400000 (GTQ)
- Convierte "150k" o "150 mil" a 150000
- Si menciona "descuento de empleado" o "soy empleado", employeeDiscount: true
- Si dice "seminuevo" o "usado", condition: "usado"
- Si dice "0km" o "nuevo", condition: "nuevo"
- Solo incluye campos que puedas inferir claramente

Contexto previo:
${context?.join('\n') || 'Sin contexto'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.2, responseFormat: 'json_object' },
    );

    try {
      const result = JSON.parse(response.content);
      // Remove null values
      return Object.fromEntries(
        Object.entries(result).filter(([_, v]) => v !== null && v !== undefined),
      );
    } catch {
      return {};
    }
  }

  async generateAutosAnswer(
    userMessage: string,
    vehicles: Array<{
      Marca: string;
      Modelo: string;
      Año: number;
      Precio: number;
      Segmento: string;
      Color: string;
      Descripción: string;
    }>,
    filters: Record<string, any>,
    context?: string[],
  ): Promise<string> {
    const vehiclesInfo = vehicles
      .map(
        (v, i) =>
          `${i + 1}. ${v.Marca} ${v.Modelo} ${v.Año} - Q${v.Precio.toLocaleString()} GTQ - ${v.Segmento} - ${v.Color}\n   ${v.Descripción.substring(0, 100)}...`,
      )
      .join('\n\n');

    const systemPrompt = `Eres un asesor de ventas de autos amigable y profesional.
Ayuda al cliente a encontrar el auto perfecto basándote en los resultados de búsqueda.

Vehículos encontrados:
${vehiclesInfo || 'No se encontraron vehículos con esos criterios.'}

Filtros aplicados: ${JSON.stringify(filters)}

Reglas:
- Presenta los autos de forma atractiva pero honesta
- Si no hay resultados, sugiere ampliar la búsqueda o preguntar por otros criterios
- Menciona 2-3 autos máximo para no abrumar
- Invita a agendar una cita para verlos en persona
- Sé conciso pero informativo

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

  async extractDatesEntities(
    userMessage: string,
    context?: string[],
  ): Promise<{
    fullName?: string;
    date?: string;
    dayOfWeek?: string;
    timePreference?: string;
    appointmentReason?: string;
    vehicleOfInterest?: string;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    const systemPrompt = `Extrae información para agendar una cita del mensaje del usuario.
Hoy es: ${today}

Responde ÚNICAMENTE con un JSON válido:
{
  "fullName": string o null (nombre completo del cliente si lo menciona),
  "date": string o null (formato DD/MM/YYYY si se puede determinar),
  "dayOfWeek": string o null (lunes, martes, miércoles, jueves, viernes, sábado, domingo),
  "timePreference": string o null (mañana, tarde, o hora específica como "3pm", "15:00"),
  "appointmentReason": string o null ("prueba_manejo" o "asesoria"),
  "vehicleOfInterest": string o null (marca/modelo del vehículo de interés)
}

Reglas:
- Si dice "mañana", calcula la fecha
- Si dice "el lunes", pon dayOfWeek: "lunes"
- Si dice "en la tarde", timePreference: "tarde"
- Si dice "a las 3", timePreference: "3pm"
- Si menciona "probar", "manejar", "test drive", appointmentReason: "prueba_manejo"
- Si menciona "información", "asesoría", "cotización", appointmentReason: "asesoria"
- Si dice "me llamo" o "soy [nombre]", extrae fullName

Contexto previo:
${context?.join('\n') || 'Sin contexto'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.2, responseFormat: 'json_object' },
    );

    try {
      const result = JSON.parse(response.content);
      return Object.fromEntries(
        Object.entries(result).filter(([_, v]) => v !== null && v !== undefined),
      );
    } catch {
      return {};
    }
  }

  async generateDatesAnswer(
    userMessage: string,
    availableSlots: Array<{
      date: string;
      dayOfWeek: string;
      time: string;
    }>,
    extractedEntities: Record<string, any>,
    context?: string[],
  ): Promise<string> {
    const slotsInfo = availableSlots
      .map((s) => `- ${s.dayOfWeek} ${s.date}: ${s.time}`)
      .join('\n');

    const systemPrompt = `Eres un asistente de citas para una agencia de autos.
Ayuda al cliente a encontrar un horario disponible para su visita.

Horarios disponibles:
${slotsInfo || 'No hay horarios disponibles con esos criterios.'}

Entidades extraídas del usuario: ${JSON.stringify(extractedEntities)}

Reglas:
- Presenta 3-5 opciones máximo
- Si hay disponibilidad, invita a confirmar el horario preferido
- Si no hay, sugiere otros días u horarios
- Menciona que puede venir a ver los autos y recibir asesoría
- Sé amable y servicial

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

  async generateValidatorQuestions(
    useCase: string,
    missingFields: string[],
    collected: Record<string, any>,
    context?: string[],
  ): Promise<string> {
    const systemPrompt = `Eres un asistente que necesita obtener información faltante del usuario.
Caso de uso: ${useCase}
Campos faltantes: ${missingFields.join(', ')}
Información ya recopilada: ${JSON.stringify(collected)}

Genera una pregunta amigable y natural para obtener la información faltante.
No menciones términos técnicos como "campos" o "datos".
Sé conversacional y directo.

Contexto de la conversación:
${context?.join('\n') || 'Sin contexto previo'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Necesito preguntar por: ${missingFields.join(', ')}` },
      ],
      { temperature: 0.7 },
    );

    return response.content;
  }

  async extractConsultationEntities(
    userMessage: string,
    context?: string[],
  ): Promise<{
    customerType?: string;
    employmentType?: string;
    age?: number;
  }> {
    const systemPrompt = `Extrae información del perfil del cliente del mensaje.
Responde ÚNICAMENTE con un JSON válido:
{
  "customerType": string o null ("nuevo" o "existente"),
  "employmentType": string o null ("asalariado" o "independiente"),
  "age": number o null (edad aproximada)
}

Reglas:
- Si dice "ya soy cliente", "compré antes", customerType: "existente"
- Si dice "primera vez", "nuevo", customerType: "nuevo"
- Si menciona "trabajo en empresa", "empleado", employmentType: "asalariado"
- Si dice "negocio propio", "freelance", "independiente", employmentType: "independiente"
- Solo incluye campos que puedas inferir claramente

Contexto previo:
${context?.join('\n') || 'Sin contexto'}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.2, responseFormat: 'json_object' },
    );

    try {
      const result = JSON.parse(response.content);
      return Object.fromEntries(
        Object.entries(result).filter(([_, v]) => v !== null && v !== undefined),
      );
    } catch {
      return {};
    }
  }
}
