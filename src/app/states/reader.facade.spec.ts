import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { PdfPageRendererService } from '../services/pdf-page-renderer.service';
import { PrayerPresetsService } from '../services/prayer-presets.service';
import { ReaderFacade } from './reader.facade';

class PdfPageRendererServiceStub {
  readonly renderedPages = signal(new Map());
  readonly isPdfAvailable = signal(true);
  readonly isPdfLoading = signal(false);
  readonly loadErrorKey = signal('');
  readonly loadErrorParams = signal<Record<string, unknown>>({});
  loadDocument = jasmine.createSpy('loadDocument').and.resolveTo(true);
  onViewportChange = jasmine.createSpy('onViewportChange');
  syncWindow = jasmine.createSpy('syncWindow').and.resolveTo();
  getRenderedPage = jasmine.createSpy('getRenderedPage');
  invalidateWindowWork = jasmine.createSpy('invalidateWindowWork');
  clear = jasmine.createSpy('clear');
}

describe('ReaderFacade', () => {
  let facade: ReaderFacade;
  let router: Router;
  let pdfPageRendererService: PdfPageRendererServiceStub;

  beforeEach(() => {
    pdfPageRendererService = new PdfPageRendererServiceStub();

    TestBed.configureTestingModule({
      providers: [
        ReaderFacade,
        PrayerPresetsService,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ presetId: 'shacharit' }),
              queryParamMap: convertToParamMap({ section: 'hodu' }),
            },
          },
        },
        {
          provide: PdfPageRendererService,
          useValue: pdfPageRendererService,
        },
      ],
    });

    facade = TestBed.inject(ReaderFacade);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('loads the preset and starts from the section query param when available', async () => {
    await facade.initialize();

    expect(facade.getPreset()?.id).toBe('shacharit');
    expect(facade.viewModel().visiblePages[0]?.pageNumber).toBe(17);
    expect(facade.viewModel().activeSlideIndex).toBe(5);
    expect(pdfPageRendererService.loadDocument).toHaveBeenCalled();
  });

  it('falls back to the page query param when the section is invalid', async () => {
    TestBed.resetTestingModule();
    pdfPageRendererService = new PdfPageRendererServiceStub();

    TestBed.configureTestingModule({
      providers: [
        ReaderFacade,
        PrayerPresetsService,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ presetId: 'shacharit' }),
              queryParamMap: convertToParamMap({ section: 'missing', page: '41' }),
            },
          },
        },
        {
          provide: PdfPageRendererService,
          useValue: pdfPageRendererService,
        },
      ],
    });

    facade = TestBed.inject(ReaderFacade);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    await facade.initialize();

    expect(facade.viewModel().visiblePages[0]?.pageNumber).toBe(36);
    expect(facade.viewModel().activeSlideIndex).toBe(5);
  });

  it('syncs the render window when the viewport becomes ready', async () => {
    await facade.initialize();

    await facade.onViewportReady({ width: 400, height: 800 });

    expect(pdfPageRendererService.onViewportChange).toHaveBeenCalledWith({
      width: 400,
      height: 800,
    });
    expect(pdfPageRendererService.syncWindow).toHaveBeenCalledWith(
      jasmine.objectContaining({
        currentPageNumber: 27,
        visiblePageNumbers: [17, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32],
      }),
    );
  });

  it('updates the route and render window after a slide settles', async () => {
    await facade.initialize();
    await facade.onViewportReady({ width: 400, height: 800 });

    pdfPageRendererService.syncWindow.calls.reset();
    facade.onSlideIndexChanged(6);
    await facade.onSlideTransitionEnd();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { page: 28, section: 'hodu' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(pdfPageRendererService.syncWindow).toHaveBeenCalledWith(
      jasmine.objectContaining({
        currentPageNumber: 28,
      }),
    );
  });

  it('jumps to a section and keeps route query params aligned', async () => {
    await facade.initialize();
    await facade.onViewportReady({ width: 400, height: 800 });

    const targetSection = facade.getSections().find((section) => section.id === 'yishtabach');
    expect(targetSection).toBeDefined();

    await facade.jumpToSection(targetSection!);

    expect(pdfPageRendererService.invalidateWindowWork).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { page: 41, section: 'yishtabach' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(pdfPageRendererService.syncWindow).toHaveBeenCalledWith(
      jasmine.objectContaining({
        currentPageNumber: 41,
      }),
    );
  });
});
