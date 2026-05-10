import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { PDFDocumentProxy } from 'ng2-pdf-viewer';
import { PrayerPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

const PDF_ASSET_PATH = '/assets/siddur/tehilat-hashem.pdf';
const MIN_SWIPE_DISTANCE = 60;

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: false,
})
export class ReaderPage implements OnInit {
  preset?: PrayerPreset;
  pdfSrc = PDF_ASSET_PATH;
  currentPage = 1;
  isPdfAvailable = false;
  isPdfLoading = true;
  loadErrorMessage = '';
  private touchStartX = 0;
  private touchStartY = 0;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly prayerPresetsService: PrayerPresetsService,
  ) {}

  async ngOnInit(): Promise<void> {
    const presetId = this.activatedRoute.snapshot.paramMap.get('presetId');
    const preset = presetId ? this.prayerPresetsService.getById(presetId) : undefined;

    if (!preset) {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.preset = preset;
    this.currentPage = preset.startPage;
    await this.checkPdfAvailability();
  }

  goToPreviousPage(): void {
    if (!this.preset || this.currentPage <= this.preset.startPage) {
      return;
    }

    this.currentPage -= 1;
  }

  goToNextPage(): void {
    if (!this.preset || this.currentPage >= this.preset.endPage) {
      return;
    }

    this.currentPage += 1;
  }

  onTouchStart(event: TouchEvent): void {
    if (!this.isPdfAvailable || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  onTouchEnd(_event?: TouchEvent): void {
    if (!this.isPdfAvailable) {
      return;
    }

    const touch = _event?.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < MIN_SWIPE_DISTANCE || absX <= absY) {
      return;
    }

    if (deltaX > 0) {
      this.goToNextPage();
      return;
    }

    this.goToPreviousPage();
  }

  onPdfLoaded(_pdf: PDFDocumentProxy): void {
    this.isPdfLoading = false;
    this.loadErrorMessage = '';
  }

  onPdfError(error: unknown): void {
    this.isPdfLoading = false;
    this.loadErrorMessage = error instanceof Error ? error.message : 'Failed to load PDF.';
  }

  private async checkPdfAvailability(): Promise<void> {
    try {
      const response = await fetch(PDF_ASSET_PATH, { method: 'HEAD' });
      this.isPdfAvailable = response.ok;
      this.isPdfLoading = response.ok;
    } catch {
      this.isPdfAvailable = false;
      this.isPdfLoading = false;
    }
  }
}
