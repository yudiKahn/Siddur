import { Injectable } from '@angular/core';
import { PrayerTimingFlags } from '../models/prayer-preset.model';

@Injectable({
  providedIn: 'root',
})
export class PrayerTimingService {
  getCurrentFlags(): PrayerTimingFlags {
    return {
      tachanun: true,
      hallel: 'none',
    };
  }
}
