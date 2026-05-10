import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PrayerPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  presets: PrayerPreset[] = [];

  constructor(
    private readonly prayerPresetsService: PrayerPresetsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.presets = this.prayerPresetsService.getAll();
  }

  openPreset(preset: PrayerPreset, page?: number): void {
    const targetPage = page ?? preset.startPage;
    void this.router.navigate(['/reader', preset.id], {
      queryParams: { page: targetPage },
    });
  }

  trackByPreset(index: number, preset: PrayerPreset): string {
    return preset.id;
  }

}
