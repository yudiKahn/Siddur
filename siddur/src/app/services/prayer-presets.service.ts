import { Injectable } from '@angular/core';
import { PrayerPreset } from '../models/prayer-preset.model';

const PRAYER_PRESETS: PrayerPreset[] = [
  {
    id: 'shacharit',
    titleHe: 'שחרית',
    titleEn: 'Shacharit',
    startPage: 6,
    endPage: 86,
    order: 1,
  },
  {
    id: 'mincha',
    titleHe: 'מנחה',
    titleEn: 'Mincha',
    startPage: 96,
    endPage: 106,
    order: 2,
  },
  {
    id: 'maariv',
    titleHe: 'ערבית',
    titleEn: 'Maariv',
    startPage: 106,
    endPage: 118,
    order: 3,
  },
];

@Injectable({
  providedIn: 'root',
})
export class PrayerPresetsService {
  getAll(): PrayerPreset[] {
    return [...PRAYER_PRESETS].sort((left, right) => left.order - right.order);
  }

  getById(id: string): PrayerPreset | undefined {
    return PRAYER_PRESETS.find((preset) => preset.id === id);
  }
}
