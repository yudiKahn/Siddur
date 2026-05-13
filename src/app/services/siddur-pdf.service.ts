import { Injectable } from '@angular/core';

const PDF_ASSET_PATH = 'assets/siddur/tehilat-hashem.pdf';
const PDF_WORKER_PATH = 'assets/pdfjs/pdf.worker.min.mjs';

const resolveAssetUrl = (path: string): string =>
  new URL(path, document.baseURI).toString();

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (src: { data: Uint8Array; disableWorker: boolean }) => {
    promise: Promise<PdfDocumentProxy>;
    destroy?: () => Promise<void> | void;
  };
};

export type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void> | void;
};

export type PdfPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
  cleanup?: () => void;
};

export class PdfLoadError extends Error {
  constructor(
    readonly translationKey: string,
    readonly interpolationParams: Record<string, unknown> = {},
  ) {
    super(translationKey);
  }
}

@Injectable({
  providedIn: 'root',
})
export class SiddurPdfService {
  private pdfJsModulePromise?: Promise<PdfJsModule>;
  private pdfDocumentPromise?: Promise<PdfDocumentProxy>;

  async getDocument(): Promise<PdfDocumentProxy> {
    this.pdfDocumentPromise ??= this.loadDocument();
    return this.pdfDocumentPromise;
  }

  prefetch(): void {
    void this.getDocument().catch(() => undefined);
  }

  private async loadDocument(): Promise<PdfDocumentProxy> {
    const response = await fetch(resolveAssetUrl(PDF_ASSET_PATH));
    if (!response.ok) {
      throw new PdfLoadError('reader.errors.pdfLoadFailedWithStatus', {
        status: response.status,
      });
    }

    const pdfData = new Uint8Array(await response.arrayBuffer());
    const pdfJs = await this.getPdfJsModule();
    pdfJs.GlobalWorkerOptions.workerSrc = resolveAssetUrl(PDF_WORKER_PATH);

    return pdfJs.getDocument({
      data: pdfData,
      disableWorker: false,
    }).promise;
  }

  private async getPdfJsModule(): Promise<PdfJsModule> {
    this.pdfJsModulePromise ??= import(
      '../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
    ) as unknown as Promise<PdfJsModule>;

    return this.pdfJsModulePromise;
  }
}
