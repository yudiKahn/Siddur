import { Injectable, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReaderViewModel,
  ReaderViewportSize,
  RenderedPdfPage,
} from '../models/pdf-reader.model';
import {
  ResolvedPrayerPage,
  ResolvedPrayerPreset,
  ResolvedPrayerSection,
} from '../models/prayer-preset.model';
import { PdfPageRendererService } from '../services/pdf-page-renderer.service';
import { PrayerPresetsService } from '../services/prayer-presets.service';

const PAGE_PRELOAD_DISTANCE = 5;
const MAX_ZOOM_RATIO = 3;

@Injectable()
export class ReaderFacade {
  readonly preset = signal<ResolvedPrayerPreset | undefined>(undefined);
  readonly isZoomed = signal(false);
  readonly renderedPages = computed(() => this.pdfPageRendererService.renderedPages());
  readonly visiblePages = computed(() => {
    const preset = this.preset();
    if (!preset) {
      return [];
    }

    const currentSequenceIndex = this.currentSequenceIndex();
    const startIndex = Math.max(0, currentSequenceIndex - PAGE_PRELOAD_DISTANCE);
    const endIndex = Math.min(
      preset.pages.length - 1,
      currentSequenceIndex + PAGE_PRELOAD_DISTANCE,
    );

    return preset.pages.slice(startIndex, endIndex + 1);
  });
  readonly activeSlideIndex = computed(() =>
    this.visiblePages().findIndex(
      (page) => page.sequenceIndex === this.currentSequenceIndex(),
    ),
  );
  readonly viewModel = computed<ReaderViewModel>(() => ({
    presetTitleKey: this.preset()?.titleKey,
    visiblePages: this.visiblePages(),
    activeSlideIndex: Math.max(0, this.activeSlideIndex()),
    isPdfAvailable: this.pdfPageRendererService.isPdfAvailable(),
    isPdfLoading: this.pdfPageRendererService.isPdfLoading(),
    isZoomed: this.isZoomed(),
    loadErrorKey: this.pdfPageRendererService.loadErrorKey(),
    loadErrorParams: this.pdfPageRendererService.loadErrorParams(),
    maxZoomRatio: MAX_ZOOM_RATIO,
  }));

  private readonly currentSequenceIndex = signal(0);
  private pendingSequenceIndex?: number;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly prayerPresetsService: PrayerPresetsService,
    private readonly pdfPageRendererService: PdfPageRendererService,
  ) {}

  async initialize(): Promise<boolean> {
    const presetId = this.activatedRoute.snapshot.paramMap.get('presetId');
    const preset = presetId ? this.prayerPresetsService.getById(presetId) : undefined;

    if (!preset) {
      return false;
    }

    this.preset.set(preset);
    this.currentSequenceIndex.set(this.resolveInitialSequenceIndex(preset));
    this.pendingSequenceIndex = undefined;
    this.isZoomed.set(false);

    return this.pdfPageRendererService.loadDocument();
  }

  async onViewportReady(size: ReaderViewportSize): Promise<void> {
    this.pdfPageRendererService.onViewportChange(size);
    await this.syncRenderedWindow();
  }

  onViewportResize(size: ReaderViewportSize): void {
    this.isZoomed.set(false);
    this.pdfPageRendererService.onViewportChange(size);
  }

  onSlideIndexChanged(nextIndex: number): void {
    const nextPage = this.visiblePages()[nextIndex];
    if (!nextPage || nextPage.sequenceIndex === this.currentSequenceIndex()) {
      return;
    }

    this.pendingSequenceIndex = nextPage.sequenceIndex;
  }

  async onSlideTransitionEnd(): Promise<void> {
    if (this.pendingSequenceIndex === undefined) {
      return;
    }

    this.currentSequenceIndex.set(this.pendingSequenceIndex);
    this.pendingSequenceIndex = undefined;
    this.isZoomed.set(false);
    this.updateRoutePage();
    await this.syncRenderedWindow();
  }

  onZoomScaleChanged(scale: number): void {
    this.isZoomed.set(scale > 1.01);
  }

  canOpenSectionSheet(): boolean {
    const preset = this.preset();
    return !!preset && preset.sections.length > 1;
  }

  getSections(): ResolvedPrayerSection[] {
    return this.preset()?.sections ?? [];
  }

  getPreset(): ResolvedPrayerPreset | undefined {
    return this.preset();
  }

  getRenderedPage(pageNumber: number): RenderedPdfPage | undefined {
    return this.pdfPageRendererService.getRenderedPage(pageNumber);
  }

  async jumpToSection(section: ResolvedPrayerSection): Promise<void> {
    await this.jumpToSequenceIndex(section.firstSequenceIndex, section.id);
  }

  async jumpToSequenceIndex(sequenceIndex: number, sectionId?: string): Promise<void> {
    const preset = this.preset();
    if (!preset) {
      return;
    }

    const targetPage = preset.pages[sequenceIndex];
    if (!targetPage || sequenceIndex === this.currentSequenceIndex()) {
      return;
    }

    this.pdfPageRendererService.invalidateWindowWork();
    this.currentSequenceIndex.set(sequenceIndex);
    this.pendingSequenceIndex = undefined;
    this.isZoomed.set(false);

    await this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: sectionId
        ? { page: targetPage.pageNumber, section: sectionId }
        : { page: targetPage.pageNumber },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    await this.syncRenderedWindow();
  }

  destroy(): void {
    this.pdfPageRendererService.clear();
  }

  private resolveInitialSequenceIndex(preset: ResolvedPrayerPreset): number {
    const sectionId = this.activatedRoute.snapshot.queryParamMap.get('section');
    if (sectionId) {
      const section = preset.sections.find((entry) => entry.id === sectionId);
      if (section) {
        return section.firstSequenceIndex;
      }
    }

    const queryPage = Number.parseInt(
      this.activatedRoute.snapshot.queryParamMap.get('page') ?? '',
      10,
    );
    if (Number.isNaN(queryPage)) {
      return 0;
    }

    const matchingIndex = preset.pages.findIndex((page) => page.pageNumber === queryPage);
    return matchingIndex >= 0 ? matchingIndex : 0;
  }

  private async syncRenderedWindow(forceRender = false): Promise<void> {
    const preset = this.preset();
    if (!preset) {
      return;
    }

    const currentPage = this.getCurrentPage();
    const visiblePageNumbers = this.visiblePages().map((page) => page.pageNumber);
    const prewarmPageNumbers = this.getPrewarmPageNumbers(preset);

    await this.pdfPageRendererService.syncWindow({
      currentPageNumber: currentPage.pageNumber,
      visiblePageNumbers,
      prewarmPageNumbers,
      forceRender,
    });
  }

  private getPrewarmPageNumbers(preset: ResolvedPrayerPreset): number[] {
    const beforeCurrent = preset.pages[this.currentSequenceIndex() - PAGE_PRELOAD_DISTANCE - 1];
    const afterCurrent = preset.pages[this.currentSequenceIndex() + PAGE_PRELOAD_DISTANCE + 1];

    return [beforeCurrent, afterCurrent]
      .filter((page): page is ResolvedPrayerPage => page !== undefined)
      .map((page) => page.pageNumber);
  }

  private updateRoutePage(): void {
    const currentPage = this.getCurrentPage();
    void this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: currentPage.pageNumber, section: currentPage.sectionId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private getCurrentPage(): ResolvedPrayerPage {
    const preset = this.preset();
    if (!preset) {
      throw new Error('Reader preset is not available.');
    }

    return preset.pages[this.currentSequenceIndex()];
  }
}
