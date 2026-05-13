export interface PdfCarouselPage {
  id: string;
  pageNumber: number;
}

export interface RenderedPdfPage {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
}

export interface ReaderViewportSize {
  width: number;
  height: number;
}

export interface ReaderViewModel {
  presetTitleKey?: string;
  visiblePages: PdfCarouselPage[];
  activeSlideIndex: number;
  isPdfAvailable: boolean;
  isPdfLoading: boolean;
  isZoomed: boolean;
  loadErrorKey: string;
  loadErrorParams: Record<string, unknown>;
  maxZoomRatio: number;
}
