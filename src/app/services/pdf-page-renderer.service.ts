import { Injectable, signal } from '@angular/core';
import { ReaderViewportSize, RenderedPdfPage } from '../models/pdf-reader.model';
import { PdfDocumentProxy, PdfLoadError, SiddurPdfService } from './siddur-pdf.service';

const MAX_RENDER_PIXEL_RATIO = 2;
const PREWARM_DELAY_MS = 120;
const RESIZE_RERENDER_DELAY_MS = 80;

@Injectable()
export class PdfPageRendererService {
  readonly renderedPages = signal(new Map<number, RenderedPdfPage>());
  readonly isPdfAvailable = signal(false);
  readonly isPdfLoading = signal(true);
  readonly loadErrorKey = signal('');
  readonly loadErrorParams = signal<Record<string, unknown>>({});

  private pdfDocument?: PdfDocumentProxy;
  private pdfDocumentPromise?: Promise<PdfDocumentProxy>;
  private viewportSize?: ReaderViewportSize;
  private renderRevision = 0;
  private readonly pendingRenders = new Map<number, Promise<void>>();
  private prewarmTimeoutId?: number;
  private resizeTimeoutId?: number;
  private lastWindow?: {
    currentPageNumber: number;
    visiblePageNumbers: number[];
    prewarmPageNumbers: number[];
  };

  constructor(private readonly siddurPdfService: SiddurPdfService) {}

  async loadDocument(): Promise<boolean> {
    if (this.pdfDocument) {
      this.isPdfAvailable.set(true);
      return true;
    }

    this.isPdfLoading.set(true);
    this.loadErrorKey.set('');
    this.loadErrorParams.set({});

    try {
      this.pdfDocumentPromise ??= this.siddurPdfService.getDocument();
      this.pdfDocument = await this.pdfDocumentPromise;
      this.isPdfAvailable.set(true);
      return true;
    } catch (error) {
      this.isPdfAvailable.set(false);
      this.isPdfLoading.set(false);
      this.loadErrorKey.set(
        error instanceof PdfLoadError ? error.translationKey : 'reader.errors.pdfLoadFailed',
      );
      this.loadErrorParams.set(
        error instanceof PdfLoadError ? error.interpolationParams : {},
      );
      return false;
    }
  }

  getRenderedPage(pageNumber: number): RenderedPdfPage | undefined {
    return this.renderedPages().get(pageNumber);
  }

  async syncWindow(config: {
    currentPageNumber: number;
    visiblePageNumbers: number[];
    prewarmPageNumbers: number[];
    forceRender?: boolean;
  }): Promise<void> {
    this.lastWindow = {
      currentPageNumber: config.currentPageNumber,
      visiblePageNumbers: [...config.visiblePageNumbers],
      prewarmPageNumbers: [...config.prewarmPageNumbers],
    };

    if (!this.pdfDocument || !this.viewportSize) {
      return;
    }

    const revision = this.renderRevision;
    const uniqueVisiblePages = Array.from(new Set(config.visiblePageNumbers));

    this.evictOutsideWindow(uniqueVisiblePages);
    await this.renderPage(config.currentPageNumber, revision, config.forceRender);
    if (revision !== this.renderRevision) {
      return;
    }

    this.updateLoadingState(config.currentPageNumber);

    const siblingPages = uniqueVisiblePages.filter(
      (pageNumber) => pageNumber !== config.currentPageNumber,
    );
    await Promise.all(
      siblingPages.map((pageNumber) => this.renderPage(pageNumber, revision, config.forceRender)),
    );

    if (revision !== this.renderRevision) {
      return;
    }

    this.updateLoadingState(config.currentPageNumber);
    this.schedulePrewarm(config.prewarmPageNumbers, revision);
  }

  onViewportChange(size: ReaderViewportSize): void {
    this.viewportSize = size;

    if (!this.pdfDocument || !this.lastWindow) {
      return;
    }

    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.clearResizeTimeout();

    const revision = this.renderRevision;
    this.resizeTimeoutId = window.setTimeout(() => {
      if (revision !== this.renderRevision || !this.lastWindow) {
        return;
      }

      void this.syncWindow({
        ...this.lastWindow,
        forceRender: true,
      });
    }, RESIZE_RERENDER_DELAY_MS);
  }

  clear(): void {
    this.renderRevision += 1;
    this.pendingRenders.clear();
    this.clearPrewarmTimeout();
    this.clearResizeTimeout();
    this.renderedPages.set(new Map());
    this.isPdfLoading.set(true);
  }

  private async renderPage(
    pageNumber: number,
    revision: number,
    forceRender = false,
  ): Promise<void> {
    if (!this.pdfDocument || !this.viewportSize) {
      return;
    }

    if (!forceRender && this.renderedPages().has(pageNumber)) {
      return;
    }

    const existingRender = this.pendingRenders.get(pageNumber);
    if (existingRender) {
      await existingRender;
      return;
    }

    const renderPromise = this.performRender(pageNumber, revision, forceRender);
    this.pendingRenders.set(pageNumber, renderPromise);

    try {
      await renderPromise;
    } finally {
      this.pendingRenders.delete(pageNumber);
    }
  }

  private async performRender(
    pageNumber: number,
    revision: number,
    forceRender: boolean,
  ): Promise<void> {
    if (!this.pdfDocument || !this.viewportSize) {
      return;
    }

    if (!forceRender && this.renderedPages().has(pageNumber)) {
      return;
    }

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = this.viewportSize.width / baseViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
      const renderViewport = page.getViewport({ scale: fitScale * pixelRatio });
      const displayWidth = Math.round(this.viewportSize.width);
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

      const nextRenderedPages = new Map(this.renderedPages());
      nextRenderedPages.set(pageNumber, {
        pageNumber,
        src: canvas.toDataURL('image/png'),
        width: displayWidth,
        height: displayHeight,
      });
      this.renderedPages.set(nextRenderedPages);
      this.loadErrorKey.set('');
      this.loadErrorParams.set({});
      page.cleanup?.();
    } catch (error) {
      if (!this.lastWindow || pageNumber !== this.lastWindow.currentPageNumber) {
        return;
      }

      this.loadErrorKey.set(
        error instanceof PdfLoadError ? error.translationKey : 'reader.errors.pdfRenderFailed',
      );
      this.loadErrorParams.set(
        error instanceof PdfLoadError ? error.interpolationParams : {},
      );
      this.isPdfLoading.set(false);
    }
  }

  private evictOutsideWindow(visiblePageNumbers: number[]): void {
    const keptPages = new Set(visiblePageNumbers);
    const nextRenderedPages = new Map(this.renderedPages());

    Array.from(nextRenderedPages.keys()).forEach((pageNumber) => {
      if (!keptPages.has(pageNumber)) {
        nextRenderedPages.delete(pageNumber);
      }
    });

    this.renderedPages.set(nextRenderedPages);
  }

  private schedulePrewarm(pageNumbers: number[], revision: number): void {
    this.clearPrewarmTimeout();

    const uniquePageNumbers = Array.from(new Set(pageNumbers));
    if (!uniquePageNumbers.length) {
      return;
    }

    this.prewarmTimeoutId = window.setTimeout(() => {
      if (revision !== this.renderRevision) {
        return;
      }

      uniquePageNumbers.forEach((pageNumber) => {
        void this.renderPage(pageNumber, revision);
      });
    }, PREWARM_DELAY_MS);
  }

  private updateLoadingState(currentPageNumber: number): void {
    const hasCurrentPage = this.renderedPages().has(currentPageNumber);
    this.isPdfLoading.set(!hasCurrentPage && !this.loadErrorKey());
  }

  private clearPrewarmTimeout(): void {
    if (this.prewarmTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.prewarmTimeoutId);
    this.prewarmTimeoutId = undefined;
  }

  private clearResizeTimeout(): void {
    if (this.resizeTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.resizeTimeoutId);
    this.resizeTimeoutId = undefined;
  }
}
