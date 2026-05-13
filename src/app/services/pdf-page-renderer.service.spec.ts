import { TestBed } from '@angular/core/testing';
import { PdfPageRendererService } from './pdf-page-renderer.service';
import { PdfLoadError, SiddurPdfService } from './siddur-pdf.service';

describe('PdfPageRendererService', () => {
  let service: PdfPageRendererService;
  let siddurPdfService: jasmine.SpyObj<SiddurPdfService>;
  let getPageSpy: jasmine.Spy;
  let cleanupSpy: jasmine.Spy;
  let renderSpy: jasmine.Spy;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    cleanupSpy = jasmine.createSpy('cleanup');
    renderSpy = jasmine.createSpy('render').and.returnValue({
      promise: Promise.resolve(),
    });
    getPageSpy = jasmine.createSpy('getPage').and.resolveTo({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 100 * scale,
        height: 200 * scale,
      }),
      render: renderSpy,
      cleanup: cleanupSpy,
    });

    siddurPdfService = jasmine.createSpyObj<SiddurPdfService>('SiddurPdfService', ['getDocument']);
    siddurPdfService.getDocument.and.resolveTo({
      numPages: 200,
      getPage: getPageSpy,
      destroy: jasmine.createSpy('destroy'),
    });

    TestBed.configureTestingModule({
      providers: [
        PdfPageRendererService,
        { provide: SiddurPdfService, useValue: siddurPdfService },
      ],
    });

    service = TestBed.inject(PdfPageRendererService);
    originalCreateElement = document.createElement.bind(document);
    spyOn(document, 'createElement').and.callFake((tagName: string): HTMLElement => {
      if (tagName !== 'canvas') {
        return originalCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: () =>
          ({
            fillStyle: '#ffffff',
            fillRect: jasmine.createSpy('fillRect'),
          }) as unknown as CanvasRenderingContext2D,
        toDataURL: () => 'data:image/png;base64,test',
      } as unknown as HTMLCanvasElement;
    });
  });

  it('loads the shared PDF document once', async () => {
    await service.loadDocument();
    await service.loadDocument();

    expect(siddurPdfService.getDocument).toHaveBeenCalledTimes(1);
    expect(service.isPdfAvailable()).toBeTrue();
  });

  it('renders the current page and caches the image', async () => {
    await service.loadDocument();
    service.onViewportChange({ width: 320, height: 640 });

    await service.syncWindow({
      currentPageNumber: 27,
      visiblePageNumbers: [27, 28],
      prewarmPageNumbers: [],
    });

    expect(getPageSpy).toHaveBeenCalledWith(27);
    expect(service.getRenderedPage(27)?.src).toBe('data:image/png;base64,test');
    expect(service.isPdfLoading()).toBeFalse();
  });

  it('evicts pages that move outside the visible window', async () => {
    await service.loadDocument();
    service.onViewportChange({ width: 320, height: 640 });

    await service.syncWindow({
      currentPageNumber: 27,
      visiblePageNumbers: [27, 28],
      prewarmPageNumbers: [],
    });
    await service.syncWindow({
      currentPageNumber: 41,
      visiblePageNumbers: [41],
      prewarmPageNumbers: [],
    });

    expect(service.getRenderedPage(27)).toBeUndefined();
    expect(service.getRenderedPage(41)).toBeDefined();
  });

  it('surfaces a render error for the active page', async () => {
    renderSpy.and.returnValue({
      promise: Promise.reject(new PdfLoadError('reader.errors.canvasUnavailable')),
    });

    await service.loadDocument();
    service.onViewportChange({ width: 320, height: 640 });
    await service.syncWindow({
      currentPageNumber: 27,
      visiblePageNumbers: [27],
      prewarmPageNumbers: [],
    });

    expect(service.loadErrorKey()).toBe('reader.errors.canvasUnavailable');
    expect(service.isPdfLoading()).toBeFalse();
  });
});
