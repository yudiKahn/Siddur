import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ResolvedPrayerPage,
  ResolvedPrayerPreset,
  ResolvedPrayerSection,
} from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';
import {
  PdfLoadError,
  PdfDocumentProxy,
  PdfPageProxy,
  SiddurPdfService,
} from '../services/siddur-pdf.service';

const PAGE_PRELOAD_DISTANCE = 5;
const MAX_RENDER_PIXEL_RATIO = 2;
const MAX_ZOOM_RATIO = 3;
const LONG_PRESS_DURATION_MS = 500;

type SwiperZoom = {
  scale?: number;
  in: (value?: number | Event) => void;
  out: () => void;
  toggle: (event?: Event) => void;
};

type SwiperElement = HTMLElement & {
  initialize: () => void;
  swiper?: {
    activeIndex: number;
    allowTouchMove: boolean;
    zoom: SwiperZoom;
    update: () => void;
    slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
  };
};

type RenderedPage = {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
};

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: true,
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonSpinner,
    TranslatePipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReaderPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('swiperRef')
  private readonly swiperRef?: ElementRef<SwiperElement>;

  @ViewChild('stageRef')
  private readonly stageRef?: ElementRef<HTMLElement>;

  preset?: ResolvedPrayerPreset;
  currentSequenceIndex = 0;
  visiblePages: ResolvedPrayerPage[] = [];
  activeSlideIndex = 0;
  isPdfAvailable = false;
  isPdfLoading = true;
  isZoomed = false;
  loadErrorKey = '';
  loadErrorParams: Record<string, unknown> = {};
  readonly maxZoomRatio = MAX_ZOOM_RATIO;

  private pdfDocument?: PdfDocumentProxy;
  private readonly renderCache = new Map<number, RenderedPage>();
  private readonly pendingRenders = new Set<number>();
  private renderRevision = 0;
  private isRecentering = false;
  private prewarmTimeoutId?: number;
  private pendingSequenceIndex?: number;
  private longPressTimeoutId?: number;
  private readonly activePointerIds = new Set<number>();

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly router = inject(Router);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly siddurPdfService = inject(SiddurPdfService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  async ngOnInit(): Promise<void> {
    const presetId = this.activatedRoute.snapshot.paramMap.get('presetId');
    const preset = presetId ? this.prayerPresetsService.getById(presetId) : undefined;

    if (!preset) {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.preset = preset;
    this.currentSequenceIndex = this.resolveInitialSequenceIndex(preset);
    this.syncVisiblePages();

    await this.loadPdfDocument();
  }

  ngAfterViewInit(): void {
    this.initializeSwiper();
    this.recenterSwiper();
    void this.prepareVisiblePages();
  }

  ngOnDestroy(): void {
    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.clearLongPressTimeout();
    this.clearRenderedPages();
  }

  onSwiperSlideChange(): void {
    const swiper = this.getSwiper();
    if (!swiper || this.isRecentering || !this.preset) {
      return;
    }

    const nextIndex = swiper.activeIndex;
    if (nextIndex === this.activeSlideIndex) {
      return;
    }

    const nextPage = this.visiblePages[nextIndex];
    if (!nextPage) {
      this.recenterSwiper();
      return;
    }

    this.pendingSequenceIndex = nextPage.sequenceIndex;
  }

  onSwiperSlideChangeTransitionEnd(): void {
    if (this.pendingSequenceIndex === undefined) {
      return;
    }

    this.currentSequenceIndex = this.pendingSequenceIndex;
    this.pendingSequenceIndex = undefined;
    this.resetZoom();
    this.syncVisiblePages();
    this.updateLoadingState();
    this.recenterSwiper();
    this.updateRoutePage();
    void this.prepareVisiblePages();
  }

  onZoomChange(event: Event): void {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const [scale] = event.detail as [number?, unknown?, unknown?];
    this.syncZoomState(scale ?? 1);
  }

  onStageDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    if ((swiper.zoom.scale ?? 1) > 1.01) {
      this.resetZoom();
      return;
    }

    swiper.zoom.in(Math.min(2, this.maxZoomRatio));
    this.syncZoomState(Math.min(2, this.maxZoomRatio));
  }

  onStageWheel(event: WheelEvent): void {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    const currentScale = swiper.zoom.scale ?? 1;
    const nextScale = event.deltaY < 0 ? currentScale + 0.25 : currentScale - 0.25;
    const clampedScale = Math.min(this.maxZoomRatio, Math.max(1, nextScale));

    if (clampedScale <= 1.01) {
      this.resetZoom();
      return;
    }

    swiper.zoom.in(clampedScale);
    this.syncZoomState(clampedScale);
  }

  onStagePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.activePointerIds.add(event.pointerId);

    if (!this.canOpenSectionSheet() || this.isZoomed || this.activePointerIds.size > 1) {
      this.clearLongPressTimeout();
      return;
    }

    this.clearLongPressTimeout();
    this.longPressTimeoutId = window.setTimeout(() => {
      void this.presentSections();
    }, LONG_PRESS_DURATION_MS);
  }

  onStagePointerMove(): void {
    if (this.activePointerIds.size > 1 || this.isZoomed) {
      this.clearLongPressTimeout();
    }
  }

  onStagePointerRelease(event: PointerEvent): void {
    this.activePointerIds.delete(event.pointerId);
    this.clearLongPressTimeout();
  }

  onStageContextMenu(event: Event): void {
    if (!this.canOpenSectionSheet()) {
      return;
    }

    event.preventDefault();
    void this.presentSections();
  }

  trackByPage(_index: number, page: ResolvedPrayerPage): string {
    return page.id;
  }

  getRenderedPage(pageNumber: number): RenderedPage | undefined {
    return this.renderCache.get(pageNumber);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.pdfDocument) {
      return;
    }

    this.resetZoom();
    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.clearRenderedPages();
    this.updateLoadingState();

    window.setTimeout(() => {
      void this.prepareVisiblePages();
    }, 50);
  }

  private async loadPdfDocument(): Promise<void> {
    this.isPdfLoading = true;
    this.loadErrorKey = '';
    this.loadErrorParams = {};

    try {
      this.pdfDocument = await this.siddurPdfService.getDocument();
      this.isPdfAvailable = true;
      this.loadErrorKey = '';
      this.loadErrorParams = {};
      this.refreshView();

      await this.waitForStageReady();
      this.initializeSwiper();
      this.recenterSwiper();

      const revision = this.renderRevision;
      await this.ensurePageRendered(this.getCurrentPage().pageNumber, revision);
      if (revision !== this.renderRevision) {
        return;
      }

      this.updateLoadingState();
      this.schedulePrewarm(revision);
      void this.prepareVisiblePages();
    } catch (error) {
      this.isPdfAvailable = false;
      this.isPdfLoading = false;
      this.loadErrorKey =
        error instanceof PdfLoadError ? error.translationKey : 'reader.errors.pdfLoadFailed';
      this.loadErrorParams =
        error instanceof PdfLoadError ? error.interpolationParams : {};
      this.refreshView();
    }
  }

  private resolveInitialSequenceIndex(preset: ResolvedPrayerPreset): number {
    const sectionId = this.activatedRoute.snapshot.queryParamMap.get('section');
    if (sectionId) {
      const section = preset.sections.find((entry) => entry.id === sectionId);
      if (section) {
        return section.firstSequenceIndex;
      }
    }

    const queryPage = Number.parseInt(this.activatedRoute.snapshot.queryParamMap.get('page') ?? '', 10);
    if (Number.isNaN(queryPage)) {
      return 0;
    }

    const matchingIndex = preset.pages.findIndex((page) => page.pageNumber === queryPage);
    return matchingIndex >= 0 ? matchingIndex : 0;
  }

  private syncVisiblePages(): void {
    if (!this.preset) {
      this.visiblePages = [];
      this.activeSlideIndex = 0;
      return;
    }

    const startIndex = Math.max(0, this.currentSequenceIndex - PAGE_PRELOAD_DISTANCE);
    const endIndex = Math.min(
      this.preset.pages.length - 1,
      this.currentSequenceIndex + PAGE_PRELOAD_DISTANCE,
    );

    this.visiblePages = this.preset.pages.slice(startIndex, endIndex + 1);
    this.activeSlideIndex = this.visiblePages.findIndex(
      (page) => page.sequenceIndex === this.currentSequenceIndex,
    );
  }

  private async prepareVisiblePages(): Promise<void> {
    if (!this.pdfDocument || !this.preset) {
      return;
    }

    const revision = this.renderRevision;
    const currentPageNumber = this.getCurrentPage().pageNumber;
    const pagesToPrepare = this.getPagesToPrepare().filter(
      (pageNumber) => pageNumber !== currentPageNumber,
    );
    this.evictStalePages();

    await Promise.all(pagesToPrepare.map((pageNumber) => this.ensurePageRendered(pageNumber, revision)));

    if (revision !== this.renderRevision) {
      return;
    }

    this.updateLoadingState();
    this.schedulePrewarm(revision);
  }

  private getPagesToPrepare(): number[] {
    if (!this.preset) {
      return [];
    }

    const pages = new Set(this.visiblePages.map((page) => page.pageNumber));
    const beforeCurrent = this.preset.pages[this.currentSequenceIndex - PAGE_PRELOAD_DISTANCE];
    const afterCurrent = this.preset.pages[this.currentSequenceIndex + PAGE_PRELOAD_DISTANCE];

    if (beforeCurrent) {
      pages.add(beforeCurrent.pageNumber);
    }

    if (afterCurrent) {
      pages.add(afterCurrent.pageNumber);
    }

    return Array.from(pages).sort((left, right) => left - right);
  }

  private evictStalePages(): void {
    if (!this.preset) {
      this.renderCache.clear();
      return;
    }

    const startIndex = Math.max(0, this.currentSequenceIndex - PAGE_PRELOAD_DISTANCE);
    const endIndex = Math.min(
      this.preset.pages.length - 1,
      this.currentSequenceIndex + PAGE_PRELOAD_DISTANCE,
    );
    const keptPages = new Set(
      this.preset.pages.slice(startIndex, endIndex + 1).map((page) => page.pageNumber),
    );

    Array.from(this.renderCache.keys()).forEach((pageNumber) => {
      if (!keptPages.has(pageNumber)) {
        this.renderCache.delete(pageNumber);
      }
    });
  }

  private schedulePrewarm(revision: number): void {
    if (!this.preset) {
      return;
    }

    this.clearPrewarmTimeout();

    this.prewarmTimeoutId = window.setTimeout(() => {
      if (revision !== this.renderRevision || !this.preset) {
        return;
      }

      const extraPages = [
        this.preset.pages[this.currentSequenceIndex - PAGE_PRELOAD_DISTANCE - 1],
        this.preset.pages[this.currentSequenceIndex + PAGE_PRELOAD_DISTANCE + 1],
      ]
        .filter((page): page is ResolvedPrayerPage => page !== undefined)
        .map((page) => page.pageNumber);

      extraPages.forEach((pageNumber) => {
        void this.ensurePageRendered(pageNumber, revision);
      });
    }, 120);
  }

  private async ensurePageRendered(pageNumber: number, revision: number): Promise<void> {
    if (!this.pdfDocument || this.renderCache.has(pageNumber) || this.pendingRenders.has(pageNumber)) {
      return;
    }

    const stageSize = this.getStageSize();
    if (!stageSize) {
      return;
    }

    this.pendingRenders.add(pageNumber);

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = stageSize.width / baseViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
      const renderViewport = page.getViewport({ scale: fitScale * pixelRatio });
      const displayWidth = Math.round(stageSize.width);
      const displayHeight = Math.round(baseViewport.height * fitScale);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new PdfLoadError('reader.errors.canvasUnavailable');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: context,
        viewport: renderViewport,
      });

      await renderTask.promise;

      if (revision !== this.renderRevision) {
        page.cleanup?.();
        return;
      }

      this.renderCache.set(pageNumber, {
        pageNumber,
        src: canvas.toDataURL('image/png'),
        width: displayWidth,
        height: displayHeight,
      });

      if (pageNumber === this.getCurrentPage().pageNumber) {
        this.isPdfLoading = false;
        this.loadErrorKey = '';
        this.loadErrorParams = {};
      }

      this.refreshView();

      page.cleanup?.();
    } catch (error) {
      if (pageNumber === this.getCurrentPage().pageNumber) {
        this.loadErrorKey =
          error instanceof PdfLoadError ? error.translationKey : 'reader.errors.pdfRenderFailed';
        this.loadErrorParams =
          error instanceof PdfLoadError ? error.interpolationParams : {};
        this.isPdfLoading = false;
        this.refreshView();
      }
    } finally {
      this.pendingRenders.delete(pageNumber);
    }
  }

  private getStageSize(): { width: number; height: number } | undefined {
    const stageElement = this.stageRef?.nativeElement;
    if (!stageElement) {
      return undefined;
    }

    const width = stageElement.clientWidth;
    const height = stageElement.clientHeight;
    return {
      width: width || window.innerWidth,
      height: height || window.innerHeight,
    };
  }

  private updateLoadingState(): void {
    this.isPdfLoading = !this.renderCache.has(this.getCurrentPage().pageNumber);
    this.refreshView();
  }

  private recenterSwiper(): void {
    const swiper = this.getSwiper();
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

  private getSwiper(): SwiperElement['swiper'] {
    return this.swiperRef?.nativeElement.swiper;
  }

  private initializeSwiper(): void {
    const swiperElement = this.swiperRef?.nativeElement;
    if (!swiperElement || swiperElement.swiper) {
      return;
    }

    Object.assign(swiperElement, {
      init: false,
      initialSlide: this.activeSlideIndex,
      speed: 250,
      passiveListeners: false,
      touchStartPreventDefault: false,
      zoom: {
        enabled: true,
        minRatio: 1,
        maxRatio: this.maxZoomRatio,
        toggle: true,
      },
    });

    swiperElement.initialize();
  }

  private resetZoom(): void {
    const swiper = this.getSwiper();
    swiper?.zoom.out();
    this.syncZoomState(1);
  }

  private syncZoomState(scale: number): void {
    this.isZoomed = scale > 1.01;
    if (this.isZoomed) {
      this.clearLongPressTimeout();
    }
    const swiper = this.getSwiper();
    if (swiper) {
      swiper.allowTouchMove = !this.isZoomed;
    }
    this.refreshView();
  }

  private clearRenderedPages(): void {
    this.pendingRenders.clear();
    this.renderCache.clear();
  }

  private clearPrewarmTimeout(): void {
    if (this.prewarmTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.prewarmTimeoutId);
    this.prewarmTimeoutId = undefined;
  }

  private refreshView(): void {
    this.changeDetectorRef.detectChanges();
  }

  private async waitForStageReady(): Promise<void> {
    if (this.stageRef?.nativeElement) {
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  private canOpenSectionSheet(): boolean {
    return !!this.preset && this.preset.sections.length > 1;
  }

  private async presentSections(): Promise<void> {
    const preset = this.preset;
    if (!preset) {
      return;
    }

    const sections = preset.sections;
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
        void this.jumpToSection(section);
      },
    };
  }

  private async jumpToSection(section: ResolvedPrayerSection): Promise<void> {
    await this.jumpToSequenceIndex(section.firstSequenceIndex, section.id);
  }

  private async jumpToSequenceIndex(sequenceIndex: number, sectionId?: string): Promise<void> {
    const preset = this.preset;
    if (!preset) {
      return;
    }

    const targetPage = preset.pages[sequenceIndex];
    if (!targetPage || sequenceIndex === this.currentSequenceIndex) {
      return;
    }

    this.currentSequenceIndex = sequenceIndex;
    this.pendingSequenceIndex = undefined;
    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.resetZoom();
    this.syncVisiblePages();
    this.updateLoadingState();
    this.recenterSwiper();

    await this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: sectionId
        ? { page: targetPage.pageNumber, section: sectionId }
        : { page: targetPage.pageNumber },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    await this.ensurePageRendered(targetPage.pageNumber, this.renderRevision);
    await this.prepareVisiblePages();
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
    if (!this.preset) {
      throw new Error('Reader preset is not available.');
    }

    return this.preset.pages[this.currentSequenceIndex];
  }

  private clearLongPressTimeout(): void {
    if (this.longPressTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.longPressTimeoutId);
    this.longPressTimeoutId = undefined;
  }
}
