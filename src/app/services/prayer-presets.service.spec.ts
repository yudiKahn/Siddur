import { TestBed } from '@angular/core/testing';

import { PRAYER_PRESETS } from '../data/prayer-presets.data';
import { PRAYER_SECTIONS } from '../data/prayer-sections.data';
import { PrayerPresetDefinition, PrayerSectionDefinition } from '../models/prayer-preset.model';
import { PrayerPresetsService } from './prayer-presets.service';
import { PrayerTimingService } from './prayer-timing.service';

describe('PrayerPresetsService', () => {
  let service: PrayerPresetsService;
  let prayerTimingService: jasmine.SpyObj<PrayerTimingService>;

  beforeEach(() => {
    prayerTimingService = jasmine.createSpyObj<PrayerTimingService>('PrayerTimingService', [
      'getCurrentFlags',
    ]);
    prayerTimingService.getCurrentFlags.and.returnValue({
      tachanun: true,
      hallel: 'none',
    });

    TestBed.configureTestingModule({
      providers: [
        PrayerPresetsService,
        { provide: PrayerTimingService, useValue: prayerTimingService },
      ],
    });

    service = TestBed.inject(PrayerPresetsService);
  });

  it('resolves shacharit into stitched sections and pages', () => {
    const preset = service.getById('shacharit');

    expect(preset).toBeDefined();
    expect(preset?.pages[0].pageNumber).toBe(6);
    expect(preset?.pages[preset.pages.length - 1].pageNumber).toBe(86);
    expect(preset?.pages).toHaveSize(80);
    expect(preset?.sections.map((section) => section.id)).toEqual([
      'birkot-hashachar',
      'korbanot',
      'hodu',
      'yishtabach',
    ]);
    expect(preset?.sections.map((section) => section.firstSequenceIndex)).toEqual([
      0,
      12,
      20,
      34,
    ]);
  });

  it('omits conditional sections when timing flags exclude them', () => {
    const testSection: PrayerSectionDefinition = {
      id: 'test-tachanun',
      titleKey: 'presets.shared.sections.tachanun',
      segments: [
        {
          startPage: 200,
          endPage: 201,
          includeWhen: 'show-tachanun',
        },
      ],
    };
    const testPreset: PrayerPresetDefinition = {
      id: 'test-conditional',
      titleKey: 'presets.mincha.title',
      order: 999,
      sections: [
        {
          sectionId: 'ashrei',
          order: 1,
        },
        {
          sectionId: 'test-tachanun',
          order: 2,
        },
      ],
    };

    PRAYER_SECTIONS.push(testSection);
    PRAYER_PRESETS.push(testPreset);
    prayerTimingService.getCurrentFlags.and.returnValue({
      tachanun: false,
      hallel: 'none',
    });

    try {
      const preset = service.getById('test-conditional');

      expect(preset).toBeDefined();
      expect(preset?.sections.map((section) => section.id)).toEqual(['ashrei']);
      expect(preset?.pages.map((page) => page.pageNumber)).not.toContain(200);
    } finally {
      PRAYER_SECTIONS.pop();
      PRAYER_PRESETS.pop();
    }
  });

  it('includes conditional sections when timing flags allow them', () => {
    const testSection: PrayerSectionDefinition = {
      id: 'test-hallel',
      titleKey: 'presets.shared.sections.hallel',
      segments: [
        {
          startPage: 210,
          endPage: 211,
          includeWhen: 'show-hallel-any',
        },
      ],
    };
    const testPreset: PrayerPresetDefinition = {
      id: 'test-hallel-preset',
      titleKey: 'presets.maariv.title',
      order: 1000,
      sections: [
        {
          sectionId: 'test-hallel',
          order: 1,
        },
      ],
    };

    PRAYER_SECTIONS.push(testSection);
    PRAYER_PRESETS.push(testPreset);
    prayerTimingService.getCurrentFlags.and.returnValue({
      tachanun: true,
      hallel: 'full',
    });

    try {
      const preset = service.getById('test-hallel-preset');

      expect(preset).toBeDefined();
      expect(preset?.sections.map((section) => section.id)).toEqual(['test-hallel']);
      expect(preset?.pages.map((page) => page.pageNumber)).toEqual([210, 211]);
    } finally {
      PRAYER_SECTIONS.pop();
      PRAYER_PRESETS.pop();
    }
  });
});
