import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
  ActionSheetOptions,
} from '@ionic/angular/standalone';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, firstValueFrom, of } from 'rxjs';

import { HomePage } from './home.page';

const TEST_TRANSLATIONS = {
  app: {
    title: 'Test Siddur',
  },
  common: {
    actions: {
      cancel: 'Cancel',
    },
  },
  presets: {
    shacharit: {
      title: 'Shacharit',
      sections: {
        birkotHashachar: 'Birkot Hashachar',
        korbanot: 'Korbanot',
        hodu: 'Hodu',
        yishtabach: 'Yishtabach',
      },
    },
    mincha: {
      title: 'Mincha',
      sections: {
        ashrei: 'Ashrei',
      },
    },
    birkatHamazon: {
      title: 'Birkat Hamazon',
    },
    tefilatHaderech: {
      title: 'Tefilat Haderech',
    },
    maariv: {
      title: 'Maariv',
    },
    kriatShemaAlHamita: {
      title: 'Kriat Shema Al Hamita',
    },
  },
};

class TestTranslateLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<TranslationObject> {
    return of(TEST_TRANSLATIONS);
  }
}

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let router: Router;
  let actionSheetController: jasmine.SpyObj<ActionSheetController>;
  let presentSpy: jasmine.Spy;
  let capturedActionSheetOptions: ActionSheetOptions | undefined;
  let translateService: TranslateService;

  beforeEach(async () => {
    presentSpy = jasmine.createSpy('present').and.resolveTo();
    actionSheetController = jasmine.createSpyObj<ActionSheetController>('ActionSheetController', ['create']);
    actionSheetController.create.and.callFake(async (options?: ActionSheetOptions) => {
      capturedActionSheetOptions = options;

      return {
        present: presentSpy,
      } as never;
    });

    await TestBed.configureTestingModule({
      imports: [
        HomePage,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: TestTranslateLoader,
          },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {},
          },
        },
        { provide: ActionSheetController, useValue: actionSheetController },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    translateService = TestBed.inject(TranslateService);
    await firstValueFrom(translateService.use('he'));
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the preset list in display order', () => {
    expect(component.presets.map((preset) => preset.id)).toEqual([
      'shacharit',
      'mincha',
      'birkat-hamazon',
      'tefilat-haderech',
      'maariv',
      'kriat-shema-al-hamita',
    ]);
  });

  it('navigates directly for the new regular presets', async () => {
    const presetExpectations = [
      { id: 'birkat-hamazon', page: 88 },
      { id: 'tefilat-haderech', page: 86 },
      { id: 'kriat-shema-al-hamita', page: 118 },
    ];

    for (const { id, page } of presetExpectations) {
      const preset = component.presets.find((entry) => entry.id === id);

      expect(preset).withContext(id).toBeDefined();

      await component.openPreset(preset!);

      expect(router.navigate).toHaveBeenCalledWith(['/reader', id], {
        queryParams: { page },
      });
    }

    expect(actionSheetController.create).not.toHaveBeenCalled();
  });

  it('opens an action sheet for mincha', async () => {
    const mincha = component.presets.find((preset) => preset.id === 'mincha');

    expect(mincha).toBeDefined();

    await component.openPreset(mincha!);

    expect(actionSheetController.create).toHaveBeenCalled();
    expect(capturedActionSheetOptions?.header).toBeUndefined();
    expect(getObjectButtons(capturedActionSheetOptions).map((button) => button.text)).toEqual([
      translateService.instant('presets.shacharit.sections.korbanot'),
      translateService.instant('presets.mincha.sections.ashrei'),
      translateService.instant('common.actions.cancel'),
    ]);
    expect(presentSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the selected mincha section start page', async () => {
    const mincha = component.presets.find((preset) => preset.id === 'mincha');

    expect(mincha).toBeDefined();

    await component.openPreset(mincha!);

    const buttons = getObjectButtons(capturedActionSheetOptions);
    const sectionExpectations = [
      {
        text: translateService.instant('presets.shacharit.sections.korbanot'),
        page: 19,
        section: 'korbanot',
      },
      {
        text: translateService.instant('presets.mincha.sections.ashrei'),
        page: 96,
        section: 'ashrei',
      },
    ];

    sectionExpectations.forEach(({ text, page, section }) => {
      const button = buttons.find((entry) => entry.text === text);

      expect(button).withContext(text).toBeDefined();
      button?.handler?.();

      expect(router.navigate).toHaveBeenCalledWith(['/reader', 'mincha'], {
        queryParams: { page, section },
      });
    });
  });

  it('opens an action sheet for shacharit', async () => {
    const shacharit = component.presets.find((preset) => preset.id === 'shacharit');

    expect(shacharit).toBeDefined();

    await component.openPreset(shacharit!);

    expect(actionSheetController.create).toHaveBeenCalled();
    expect(capturedActionSheetOptions?.header).toBeUndefined();
    expect(getObjectButtons(capturedActionSheetOptions).map((button) => button.text)).toEqual([
      translateService.instant('presets.shacharit.sections.birkotHashachar'),
      translateService.instant('presets.shacharit.sections.korbanot'),
      translateService.instant('presets.shacharit.sections.hodu'),
      translateService.instant('presets.shacharit.sections.yishtabach'),
      translateService.instant('common.actions.cancel'),
    ]);
    expect(presentSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the selected shacharit section start page', async () => {
    const shacharit = component.presets.find((preset) => preset.id === 'shacharit');

    expect(shacharit).toBeDefined();

    await component.openPreset(shacharit!);

    const buttons = getObjectButtons(capturedActionSheetOptions);
    const sectionExpectations = [
      {
        text: translateService.instant('presets.shacharit.sections.birkotHashachar'),
        page: 6,
      },
      {
        text: translateService.instant('presets.shacharit.sections.korbanot'),
        page: 19,
      },
      {
        text: translateService.instant('presets.shacharit.sections.hodu'),
        page: 27,
      },
      {
        text: translateService.instant('presets.shacharit.sections.yishtabach'),
        page: 41,
      },
    ];

    sectionExpectations.forEach(({ text, page }) => {
      const button = buttons.find((entry) => entry.text === text);

      expect(button).withContext(text).toBeDefined();
      button?.handler?.();

      expect(router.navigate).toHaveBeenCalledWith(['/reader', 'shacharit'], {
        queryParams: {
          page,
          section:
            page === 6
              ? 'birkot-hashachar'
                : page === 19
                ? 'korbanot'
                : page === 27
                  ? 'hodu'
                  : 'yishtabach',
        },
      });
    });
  });

  function getObjectButtons(options?: ActionSheetOptions): ActionSheetButton[] {
    return (options?.buttons ?? []).filter(
      (button): button is ActionSheetButton => typeof button !== 'string',
    );
  }
});
