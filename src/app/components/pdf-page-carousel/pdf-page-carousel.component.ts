import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnChanges,
  SimpleChanges,
  ViewChild,
  input,
  output,
} from '@angular/core';
import { IonSpinner } from '@ionic/angular/standalone';
import { PdfCarouselPage, ReaderViewportSize, RenderedPdfPage } from '../../models/pdf-reader.model';

type SwiperZoom = {
  scale?: number;
  in: (value?: number | Event) => void;
  out: () => void;
};

type SwiperInstance = {
  activeIndex: number;
  allowTouchMove: boolean;
  zoom: SwiperZoom;
  update: () => void;
  slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
};

type SwiperElement = HTMLElement & {
  initialize: () => void;
  swiper?: SwiperInstance;
};

@Component({
  selector: 'app-pdf-page-carousel',
  templateUrl: './pdf-page-carousel.component.html',
  styleUrls: ['./pdf-page-carousel.component.scss'],
  standalone: true,
  imports: [IonSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PdfPageCarouselComponent implements AfterViewInit, OnChanges {
  readonly pages = input.required<PdfCarouselPage[]>();
  readonly activeSlideIndex = input(0);
  readonly renderedPages = input.required<Map<number, RenderedPdfPage>>();
  readonly isLoading = input(false);
  readonly isZoomed = input(false);
  readonly maxZoomRatio = input(3);

  readonly viewportReady = output<ReaderViewportSize>();
  readonly viewportResize = output<ReaderViewportSize>();
  readonly slideIndexChanged = output<number>();
  readonly slideTransitionEnded = output<void>();
  readonly zoomScaleChanged = output<number>();
  readonly doubleClick = output<MouseEvent>();
  readonly wheelZoom = output<WheelEvent>();
  readonly pointerDown = output<PointerEvent>();
  readonly pointerMove = output<void>();
  readonly pointerRelease = output<PointerEvent>();
  readonly contextMenu = output<Event>();

  @ViewChild('swiperRef')
  private readonly swiperRef?: ElementRef<SwiperElement>;

  @ViewChild('stageRef')
  private readonly stageRef?: ElementRef<HTMLElement>;

  private isRecentering = false;

  ngAfterViewInit(): void {
    this.initializeSwiper();
    this.recenterSwiper();
    this.emitViewportReady();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      ('pages' in changes && !changes['pages'].firstChange) ||
      ('activeSlideIndex' in changes && !changes['activeSlideIndex'].firstChange)
    ) {
      this.recenterSwiper();
    }

    if ('isZoomed' in changes) {
      this.syncTouchMoveState();
    }
  }

  getRenderedPage(pageNumber: number): RenderedPdfPage | undefined {
    return this.renderedPages().get(pageNumber);
  }

  resetZoom(): void {
    const swiper = this.getSwiper();
    swiper?.zoom.out();
    this.zoomScaleChanged.emit(1);
  }

  zoomTo(scale: number): void {
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    swiper.zoom.in(scale);
    this.zoomScaleChanged.emit(scale);
  }

  getZoomScale(): number {
    return this.getSwiper()?.zoom.scale ?? 1;
  }

  onSwiperSlideChange(): void {
    const swiper = this.getSwiper();
    if (!swiper || this.isRecentering) {
      return;
    }

    this.slideIndexChanged.emit(swiper.activeIndex);
  }

  onSwiperSlideChangeTransitionEnd(): void {
    if (this.isRecentering) {
      return;
    }

    this.slideTransitionEnded.emit();
  }

  onZoomChange(event: Event): void {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const [scale] = event.detail as [number?, unknown?, unknown?];
    this.zoomScaleChanged.emit(scale ?? 1);
  }

  onStageDoubleClick(event: MouseEvent): void {
    this.doubleClick.emit(event);
  }

  onStageWheel(event: WheelEvent): void {
    this.wheelZoom.emit(event);
  }

  onStagePointerDown(event: PointerEvent): void {
    this.pointerDown.emit(event);
  }

  onStagePointerMove(): void {
    this.pointerMove.emit();
  }

  onStagePointerRelease(event: PointerEvent): void {
    this.pointerRelease.emit(event);
  }

  onStageContextMenu(event: Event): void {
    this.contextMenu.emit(event);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const size = this.getViewportSize();
    if (!size) {
      return;
    }

    this.resetZoom();
    this.recenterSwiper();
    this.viewportResize.emit(size);
  }

  trackByPage(_index: number, page: PdfCarouselPage): string {
    return page.id;
  }

  private emitViewportReady(): void {
    const size = this.getViewportSize();
    if (!size) {
      return;
    }

    this.viewportReady.emit(size);
  }

  private initializeSwiper(): void {
    const swiperElement = this.swiperRef?.nativeElement;
    if (!swiperElement || swiperElement.swiper) {
      return;
    }

    Object.assign(swiperElement, {
      init: false,
      initialSlide: this.activeSlideIndex(),
      speed: 250,
      passiveListeners: false,
      touchStartPreventDefault: false,
      zoom: {
        enabled: true,
        minRatio: 1,
        maxRatio: this.maxZoomRatio(),
        toggle: true,
      },
    });

    swiperElement.initialize();
    this.syncTouchMoveState();
  }

  private recenterSwiper(): void {
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    this.isRecentering = true;
    requestAnimationFrame(() => {
      swiper.update();
      swiper.slideTo(this.activeSlideIndex(), 0, false);
      requestAnimationFrame(() => {
        this.isRecentering = false;
      });
    });
  }

  private syncTouchMoveState(): void {
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    swiper.allowTouchMove = !this.isZoomed();
  }

  private getViewportSize(): ReaderViewportSize | undefined {
    const stageElement = this.stageRef?.nativeElement;
    if (!stageElement) {
      return undefined;
    }

    const width = stageElement.clientWidth || window.innerWidth;
    const height = stageElement.clientHeight || window.innerHeight;
    return { width, height };
  }

  private getSwiper(): SwiperInstance | undefined {
    return this.swiperRef?.nativeElement.swiper;
  }
}
