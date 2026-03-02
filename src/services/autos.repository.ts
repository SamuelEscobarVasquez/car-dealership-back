import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Vehicle {
  Marca: string;
  Modelo: string;
  Año: number;
  Kilometraje: number;
  Color: string;
  Descripción: string;
  Puertas: number;
  Segmento: string;
  Precio: number;
  Estado: string;
  Ciudad: string;
  'Tipo de combustible': string;
  Motor: number;
  Transmisión: string;
  URL: string;
  Cantidad: number;
}

export interface AutosData {
  available_vehicles: Vehicle[];
}

export interface AutosFilters {
  brand?: string;
  model?: string;
  maxPrice?: number;
  minPrice?: number;
  year?: number;
  minYear?: number;
  maxYear?: number;
  segment?: string;
  transmission?: string;
  color?: string;
  keywords?: string;
}

@Injectable()
export class AutosRepository {
  private autosData: AutosData;

  constructor() {
    this.loadAutosData();
  }

  private loadAutosData(): void {
    try {
      const autosPath = path.join(process.cwd(), 'data', 'autos.json');
      const rawData = fs.readFileSync(autosPath, 'utf-8');
      this.autosData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading autos data:', error);
      this.autosData = { available_vehicles: [] };
    }
  }

  listAll(limit: number = 10): Vehicle[] {
    return this.autosData.available_vehicles.slice(0, limit);
  }

  search(filters: AutosFilters, limit: number = 5): Vehicle[] {
    let results = [...this.autosData.available_vehicles];

    // Filter by brand (marca)
    if (filters.brand) {
      const brandNorm = this.normalizeText(filters.brand);
      results = results.filter((v) =>
        this.normalizeText(v.Marca).includes(brandNorm),
      );
    }

    // Filter by model (modelo)
    if (filters.model) {
      const modelNorm = this.normalizeText(filters.model);
      results = results.filter((v) =>
        this.normalizeText(v.Modelo).includes(modelNorm),
      );
    }

    // Filter by max price
    if (filters.maxPrice) {
      results = results.filter((v) => v.Precio <= filters.maxPrice!);
    }

    // Filter by min price
    if (filters.minPrice) {
      results = results.filter((v) => v.Precio >= filters.minPrice!);
    }

    // Filter by exact year
    if (filters.year) {
      results = results.filter((v) => v.Año === filters.year);
    }

    // Filter by min year
    if (filters.minYear) {
      results = results.filter((v) => v.Año >= filters.minYear!);
    }

    // Filter by max year
    if (filters.maxYear) {
      results = results.filter((v) => v.Año <= filters.maxYear!);
    }

    // Filter by segment (SUV, Sedán, etc.)
    if (filters.segment) {
      const segmentNorm = this.normalizeText(filters.segment);
      results = results.filter((v) =>
        this.normalizeText(v.Segmento).includes(segmentNorm),
      );
    }

    // Filter by transmission
    if (filters.transmission) {
      const transNorm = this.normalizeText(filters.transmission);
      results = results.filter((v) =>
        this.normalizeText(v.Transmisión).includes(transNorm),
      );
    }

    // Filter by color
    if (filters.color) {
      const colorNorm = this.normalizeText(filters.color);
      results = results.filter((v) =>
        this.normalizeText(v.Color).includes(colorNorm),
      );
    }

    // Filter by keywords in description
    if (filters.keywords) {
      const keywordsNorm = this.normalizeText(filters.keywords);
      const words = keywordsNorm.split(' ').filter((w) => w.length > 2);
      results = results.filter((v) => {
        const descNorm = this.normalizeText(v.Descripción);
        return words.some((word) => descNorm.includes(word));
      });
    }

    // Sort by price ascending
    results.sort((a, b) => a.Precio - b.Precio);

    return results.slice(0, limit);
  }

  getAvailableBrands(): string[] {
    const brands = new Set(this.autosData.available_vehicles.map((v) => v.Marca));
    return Array.from(brands).sort();
  }

  getAvailableSegments(): string[] {
    const segments = new Set(this.autosData.available_vehicles.map((v) => v.Segmento));
    return Array.from(segments).sort();
  }

  getPriceRange(): { min: number; max: number } {
    const prices = this.autosData.available_vehicles.map((v) => v.Precio);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
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
