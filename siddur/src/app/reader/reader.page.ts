import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { PDFDocumentProxy } from 'ng2-pdf-viewer';
import { PrayerPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

const PDF_ASSET_PATH = '/assets/siddur/tehilat-hashem.pdf';

type SwiperElement = HTMLElement & {
  swiper?: {
    activeIndex: number;
    update: () => void;
    slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
  };
};

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: false,
})
export class ReaderPage implements OnInit, AfterViewInit {
  @ViewChild('swiperRef')
  private readonly swiperRef?: ElementRef<SwiperElement>;

  preset?: PrayerPreset;
  pdfSrc = PDF_ASSET_PATH;
  currentPage = 1;
  visiblePages: number[] = [];
  activeSlideIndex = 0;
  isPdfAvailable = false;
  isPdfLoading = true;
  loadErrorMessage = '';
  private readonly renderedPages = new Set<number>();
  private isRecentering = false;

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
    this.currentPage = this.resolveInitialPage(preset);
    this.syncVisiblePages();
    await this.checkPdfAvailability();
  }

  ngAfterViewInit(): void {
    this.recenterSwiper();
  }

  onSwiperSlideChange(): void {
    const swiper = this.swiperRef?.nativeElement.swiper;
    if (!swiper || this.isRecentering || !this.preset) {
      return;
    }

    const nextIndex = swiper.activeIndex;
    if (nextIndex === this.activeSlideIndex) {
      return;
    }

    const direction = nextIndex > this.activeSlideIndex ? 1 : -1;
    const nextPage = this.currentPage + direction;
    if (nextPage < this.preset.startPage || nextPage > this.preset.endPage) {
      this.recenterSwiper();
      return;
    }

    this.currentPage = nextPage;
    this.syncVisiblePages();
    this.isPdfLoading = !this.renderedPages.has(this.currentPage);
    this.recenterSwiper();
  }

  onPdfLoaded(_pdf: PDFDocumentProxy): void {
    this.isPdfLoading = false;
    this.loadErrorMessage = '';
    this.renderedPages.add(this.currentPage);
  }

  onPageRendered(pageNumber: number): void {
    this.renderedPages.add(pageNumber);
    if (pageNumber === this.currentPage) {
      this.isPdfLoading = false;
      this.loadErrorMessage = '';
    }
  }

  onPdfError(error: unknown): void {
    this.isPdfLoading = false;
    this.loadErrorMessage = error instanceof Error ? error.message : 'Failed to load PDF.';
  }

  trackByPage(_index: number, pageNumber: number): number {
    return pageNumber;
  }

  private async checkPdfAvailability(): Promise<void> {
    try {
      const response = await fetch(PDF_ASSET_PATH, { method: 'HEAD' });
      this.isPdfAvailable = response.ok;
      this.isPdfLoading = response.ok && !this.renderedPages.has(this.currentPage);
    } catch {
      this.isPdfAvailable = false;
      this.isPdfLoading = false;
    }
  }

  private resolveInitialPage(preset: PrayerPreset): number {
    const queryPage = Number.parseInt(this.activatedRoute.snapshot.queryParamMap.get('page') ?? '', 10);

    if (Number.isNaN(queryPage)) {
      return preset.startPage;
    }

    return Math.min(preset.endPage, Math.max(preset.startPage, queryPage));
  }

  private syncVisiblePages(): void {
    if (!this.preset) {
      this.visiblePages = [];
      this.activeSlideIndex = 0;
      return;
    }

    if (this.currentPage <= this.preset.startPage) {
      this.visiblePages =
        this.currentPage < this.preset.endPage
          ? [this.currentPage, this.currentPage + 1]
          : [this.currentPage];
      this.activeSlideIndex = 0;
      return;
    }

    if (this.currentPage >= this.preset.endPage) {
      this.visiblePages = [this.currentPage - 1, this.currentPage];
      this.activeSlideIndex = 1;
      return;
    }

    this.visiblePages = [this.currentPage - 1, this.currentPage, this.currentPage + 1];
    this.activeSlideIndex = 1;
  }

  private recenterSwiper(): void {
    const swiper = this.swiperRef?.nativeElement.swiper;
    if (!swiper) {
      return;
    }

    this.isRecentering = true;
    requestAnimationFrame(() => {
      swiper.update();
      swiper.slideTo(this.activeSlideIndex, 0, false);
      requestAnimationFrame(() => {
        this.isRecentering = false;
      });
    });
  }
}
