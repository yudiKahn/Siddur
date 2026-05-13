import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrayerPresetSummary, ResolvedPrayerSection } from '../../models/prayer-preset.model';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

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
    TranslatePipe,
  ],
})
export class HomePage implements OnInit {
  presets: PrayerPresetSummary[] = [];
  primaryPresets: PrayerPresetSummary[] = [];
  supplementalPresets: PrayerPresetSummary[] = [];
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly primaryPresetIds = new Set(['shacharit', 'mincha', 'maariv']);

  ngOnInit(): void {
    this.presets = this.prayerPresetsService.getAll();
    this.primaryPresets = this.presets.filter((preset) => this.primaryPresetIds.has(preset.id));
    this.supplementalPresets = this.presets.filter((preset) => !this.primaryPresetIds.has(preset.id));
  }

  async openPreset(
    preset: PrayerPresetSummary,
    page?: number,
    sectionId?: string,
  ): Promise<void> {
    if (!page && preset.sections.length > 1) {
      await this.presentSubPresets(preset);
      return;
    }

    this.navigateToPreset(preset, page, sectionId);
  }

  trackByPreset(index: number, preset: PrayerPresetSummary): string {
    return preset.id;
  }

  private navigateToPreset(
    preset: PrayerPresetSummary,
    page?: number,
    sectionId?: string,
  ): void {
    const targetPage = page ?? preset.initialPage;
    void this.router.navigate(['/reader', preset.id], {
      queryParams: sectionId ? { page: targetPage, section: sectionId } : { page: targetPage },
    });
  }

  private async presentSubPresets(preset: PrayerPresetSummary): Promise<void> {
    const sections = preset.sections;
    if (!sections.length) {
      this.navigateToPreset(preset);
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      buttons: [
        ...sections.map((section) => this.toActionSheetButton(preset, section)),
        {
          text: this.translateService.instant('common.actions.cancel'),
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  private toActionSheetButton(
    preset: PrayerPresetSummary,
    section: ResolvedPrayerSection,
  ): ActionSheetButton {
    return {
      text: this.translateService.instant(section.titleKey),
      handler: () => {
        this.navigateToPreset(preset, section.firstPage, section.id);
      },
    };
  }
}
