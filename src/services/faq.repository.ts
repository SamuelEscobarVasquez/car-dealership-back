import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface FaqQuestion {
  id: number;
  pregunta: string;
  respuesta: string;
}

interface FaqCategory {
  categoria: string;
  preguntas: FaqQuestion[];
}

interface FaqData {
  faq_agencia_autos: FaqCategory[];
}

@Injectable()
export class FaqRepository {
  private faqData: FaqData;

  constructor() {
    this.loadFaqData();
  }

  private loadFaqData(): void {
    try {
      const faqPath = path.join(process.cwd(), '..', 'car-dealership-front', 'data', 'faq.json');
      const rawData = fs.readFileSync(faqPath, 'utf-8');
      this.faqData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading FAQ data:', error);
      this.faqData = { faq_agencia_autos: [] };
    }
  }

  getAllFaqs(): FaqQuestion[] {
    return this.faqData.faq_agencia_autos.flatMap((cat) => cat.preguntas);
  }

  getCategories(): string[] {
    return this.faqData.faq_agencia_autos.map((cat) => cat.categoria);
  }

  getFaqsByCategory(category: string): FaqQuestion[] {
    const cat = this.faqData.faq_agencia_autos.find(
      (c) => c.categoria.toLowerCase() === category.toLowerCase(),
    );
    return cat?.preguntas || [];
  }

  searchFaqs(
    query: string,
    limit: number = 5,
  ): Array<{ pregunta: string; respuesta: string; score: number }> {
    const allFaqs = this.getAllFaqs();
    const queryWords = this.normalizeText(query).split(' ').filter(w => w.length > 2);

    const scored = allFaqs.map((faq) => {
      const preguntaNorm = this.normalizeText(faq.pregunta);
      const respuestaNorm = this.normalizeText(faq.respuesta);
      
      let score = 0;
      
      for (const word of queryWords) {
        if (preguntaNorm.includes(word)) score += 3;
        if (respuestaNorm.includes(word)) score += 1;
      }

      // Bonus for exact phrase match
      const queryNorm = this.normalizeText(query);
      if (preguntaNorm.includes(queryNorm)) score += 5;

      return {
        pregunta: faq.pregunta,
        respuesta: faq.respuesta,
        score,
      };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
