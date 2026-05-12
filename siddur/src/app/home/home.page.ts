import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { PrayerPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class HomePage implements OnInit {
  presets: PrayerPreset[] = [];
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);

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
