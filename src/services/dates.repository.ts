import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface DateSlots {
  fecha: string;
  slots: string[];
}

export interface DatesSearchFilters {
  date?: string; // DD/MM/YYYY (formato Guatemala) - se convierte internamente a YYYY-MM-DD
  dayOfWeek?: string; // lunes, martes, etc.
  timePreference?: 'mañana' | 'tarde' | 'noche' | string;
}

export interface FormattedSlot {
  date: string;
  dayOfWeek: string;
  time: string;
  isoString: string;
}

@Injectable()
export class DatesRepository {
  private datesData: DateSlots[];
  private dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  constructor() {
    this.loadDatesData();
  }

  private loadDatesData(): void {
    try {
      const datesPath = path.join(process.cwd(), 'data', 'dates.json');
      const rawData = fs.readFileSync(datesPath, 'utf-8');
      this.datesData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading dates data:', error);
      this.datesData = [];
    }
  }

  listAll(limit: number = 7): DateSlots[] {
    return this.datesData.slice(0, limit);
  }

  getByDate(date: string): DateSlots | null {
    return this.datesData.find((d) => d.fecha === date) || null;
  }

  search(filters: DatesSearchFilters, limit: number = 5): FormattedSlot[] {
    let results: FormattedSlot[] = [];

    // Filter dates by specific date or day of week
    let filteredDates = [...this.datesData];

    if (filters.date) {
      // Convertir fecha de usuario (DD/MM/YYYY) a formato interno (YYYY-MM-DD)
      const isoDate = this.parseUserDate(filters.date) || filters.date;
      filteredDates = filteredDates.filter((d) => d.fecha === isoDate);
    }

    if (filters.dayOfWeek) {
      const targetDay = this.normalizeText(filters.dayOfWeek);
      filteredDates = filteredDates.filter((d) => {
        const dateObj = new Date(d.fecha + 'T12:00:00');
        const dayName = this.dayNames[dateObj.getDay()];
        return dayName.includes(targetDay) || targetDay.includes(dayName);
      });
    }

    // Convert to FormattedSlot and apply time preference
    for (const dateEntry of filteredDates) {
      const dateObj = new Date(dateEntry.fecha + 'T12:00:00');
      const dayOfWeek = this.capitalizeFirst(this.dayNames[dateObj.getDay()]);

      for (const slotIso of dateEntry.slots) {
        const slotDate = new Date(slotIso);
        const hour = slotDate.getUTCHours();
        
        // Apply time preference filter
        if (filters.timePreference) {
          const pref = this.normalizeText(filters.timePreference);
          if (pref.includes('mañana') || pref.includes('manana')) {
            // Morning: 9-12
            if (hour < 9 || hour >= 12) continue;
          } else if (pref.includes('tarde')) {
            // Afternoon: 12-18
            if (hour < 12 || hour >= 18) continue;
          } else if (pref.includes('noche')) {
            // Evening: 18-22
            if (hour < 18 || hour >= 22) continue;
          }
        }

        results.push({
          date: this.formatDateForUser(dateEntry.fecha),
          dayOfWeek,
          time: this.formatTime(hour),
          isoString: slotIso,
        });
      }

      if (results.length >= limit * 3) break; // Get enough results before limiting
    }

    return results.slice(0, limit);
  }

  getNextAvailableDays(count: number = 5): Array<{ date: string; dayOfWeek: string; slotsCount: number }> {
    const today = new Date().toISOString().split('T')[0];
    
    return this.datesData
      .filter((d) => d.fecha >= today)
      .slice(0, count)
      .map((d) => {
        const dateObj = new Date(d.fecha + 'T12:00:00');
        return {
          date: this.formatDateForUser(d.fecha),
          dayOfWeek: this.capitalizeFirst(this.dayNames[dateObj.getDay()]),
          slotsCount: d.slots.length,
        };
      });
  }

  private formatTime(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${hour12}:00 ${period}`;
  }

  // Convierte DD/MM/YYYY a YYYY-MM-DD (interno)
  parseUserDate(userDate: string): string | null {
    // Si ya está en formato ISO, devolverlo
    if (/^\d{4}-\d{2}-\d{2}$/.test(userDate)) {
      return userDate;
    }
    // Formato DD/MM/YYYY
    const match = userDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return null;
  }

  // Convierte YYYY-MM-DD a DD/MM/YYYY (para mostrar)
  formatDateForUser(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  private capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
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
