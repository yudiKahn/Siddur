import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ResolvedPrayerSection } from '../../models/prayer-preset.model';
import { PdfPageRendererService } from '../../services/pdf-page-renderer.service';
import { ReaderFacade } from '../../states/reader.facade';
import { PdfPageCarouselComponent } from '../pdf-page-carousel/pdf-page-carousel.component';

const LONG_PRESS_DURATION_MS = 500;

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    PdfPageCarouselComponent,
    TranslatePipe,
  ],
  providers: [PdfPageRendererService, ReaderFacade],
})
export class ReaderPage implements OnInit, OnDestroy {
  readonly facade = inject(ReaderFacade);

  private longPressTimeoutId?: number;
  private readonly activePointerIds = new Set<number>();
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  async ngOnInit(): Promise<void> {
    const isReady = await this.facade.initialize();
    if (!isReady && !this.facade.getPreset()) {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
    }
  }

  ngOnDestroy(): void {
    this.facade.destroy();
    this.clearLongPressTimeout();
  }

  async onViewportReady(size: { width: number; height: number }): Promise<void> {
    await this.facade.onViewportReady(size);
  }

  onViewportResize(size: { width: number; height: number }): void {
    this.facade.onViewportResize(size);
  }

  onSwiperSlideChange(nextIndex: number): void {
    this.facade.onSlideIndexChanged(nextIndex);
  }

  async onSwiperSlideChangeTransitionEnd(carousel: PdfPageCarouselComponent): Promise<void> {
    carousel.resetZoom();
    await this.facade.onSlideTransitionEnd();
  }

  onZoomChange(scale: number): void {
    this.facade.onZoomScaleChanged(scale);
  }

  onStageDoubleClick(event: MouseEvent, carousel: PdfPageCarouselComponent): void {
    event.preventDefault();

    if (carousel.getZoomScale() > 1.01) {
      carousel.resetZoom();
      return;
    }

    carousel.zoomTo(Math.min(2, this.facade.viewModel().maxZoomRatio));
  }

  onStageWheel(event: WheelEvent, carousel: PdfPageCarouselComponent): void {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    const currentScale = carousel.getZoomScale();
    const nextScale = event.deltaY < 0 ? currentScale + 0.25 : currentScale - 0.25;
    const clampedScale = Math.min(this.facade.viewModel().maxZoomRatio, Math.max(1, nextScale));

    if (clampedScale <= 1.01) {
      carousel.resetZoom();
      return;
    }

    carousel.zoomTo(clampedScale);
  }

  onStagePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.activePointerIds.add(event.pointerId);

    if (
      !this.facade.canOpenSectionSheet() ||
      this.facade.viewModel().isZoomed ||
      this.activePointerIds.size > 1
    ) {
      this.clearLongPressTimeout();
      return;
    }

    this.clearLongPressTimeout();
    this.longPressTimeoutId = window.setTimeout(() => {
      void this.presentSections();
    }, LONG_PRESS_DURATION_MS);
  }

  onStagePointerMove(): void {
    if (this.activePointerIds.size > 1 || this.facade.viewModel().isZoomed) {
      this.clearLongPressTimeout();
    }
  }

  onStagePointerRelease(event: PointerEvent): void {
    this.activePointerIds.delete(event.pointerId);
    this.clearLongPressTimeout();
  }

  onStageContextMenu(event: Event): void {
    if (!this.facade.canOpenSectionSheet()) {
      return;
    }

    event.preventDefault();
    void this.presentSections();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  private async presentSections(): Promise<void> {
    const preset = this.facade.getPreset();
    if (!preset) {
      return;
    }

    const sections = this.facade.getSections();
    if (!sections.length) {
      return;
    }

    this.clearLongPressTimeout();

    const actionSheet = await this.actionSheetController.create({
      header: this.translateService.instant(preset.titleKey),
      buttons: [
        ...sections.map((section) => this.toActionSheetButton(section)),
        {
          text: this.translateService.instant('common.actions.cancel'),
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  private toActionSheetButton(section: ResolvedPrayerSection): ActionSheetButton {
    return {
      text: this.translateService.instant(section.titleKey),
      handler: () => {
        void this.facade.jumpToSection(section);
      },
    };
  }

  private clearLongPressTimeout(): void {
    if (this.longPressTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.longPressTimeoutId);
    this.longPressTimeoutId = undefined;
  }
}
