import { PrayerSectionDefinition } from '../models/prayer-preset.model';

export const PRAYER_SECTIONS: PrayerSectionDefinition[] = [
  {
    id: 'birkot-hashachar',
    titleKey: 'presets.shacharit.sections.birkotHashachar',
    segments: [
      {
        startPage: 6,
        endPage: 17,
      },
    ],
  },
  {
    id: 'korbanot',
    titleKey: 'presets.shacharit.sections.korbanot',
    segments: [
      {
        startPage: 19,
        endPage: 26,
      },
    ],
  },
  {
    id: 'hodu',
    titleKey: 'presets.shacharit.sections.hodu',
    segments: [
      {
        startPage: 27,
        endPage: 40,
      },
    ],
  },
  {
    id: 'yishtabach',
    titleKey: 'presets.shacharit.sections.yishtabach',
    segments: [
      {
        startPage: 41,
        endPage: 86,
      },
    ],
  },
  {
    id: 'tefilat-haderech',
    titleKey: 'presets.tefilatHaderech.sections.main',
    segments: [
      {
        startPage: 86,
        endPage: 86,
      },
    ],
  },
  {
    id: 'birkat-hamazon',
    titleKey: 'presets.birkatHamazon.sections.main',
    segments: [
      {
        startPage: 88,
        endPage: 94,
      },
    ],
  },
  {
    id: 'ashrei',
    titleKey: 'presets.mincha.sections.ashrei',
    segments: [
      {
        startPage: 96,
        endPage: 106,
      },
    ],
  },
  {
    id: 'maariv-main',
    titleKey: 'presets.maariv.sections.main',
    segments: [
      {
        startPage: 106,
        endPage: 118,
      },
    ],
  },
  {
    id: 'kriat-shema-al-hamita',
    titleKey: 'presets.kriatShemaAlHamita.sections.main',
    segments: [
      {
        startPage: 118,
        endPage: 124,
      },
    ],
  },
  {
    id: 'tachanun',
    titleKey: 'presets.shared.sections.tachanun',
    segments: [
      {
        startPage: 0,
        endPage: 0,
        includeWhen: 'show-tachanun',
      },
    ],
  },
  {
    id: 'hallel',
    titleKey: 'presets.shared.sections.hallel',
    segments: [
      {
        startPage: 0,
        endPage: 0,
        includeWhen: 'show-hallel-any',
      },
    ],
  },
];
