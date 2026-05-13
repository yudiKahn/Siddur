import { PrayerPresetDefinition, PrayerPresetSectionRef } from '../models/prayer-preset.model';

const sortSections = (sections: PrayerPresetSectionRef[]): PrayerPresetSectionRef[] =>
  [...sections].sort((left, right) => left.order - right.order);

export const PRAYER_PRESETS: PrayerPresetDefinition[] = [
  {
    id: 'shacharit',
    titleKey: 'presets.shacharit.title',
    order: 1,
    sections: sortSections([
      {
        sectionId: 'birkot-hashachar',
        order: 1,
      },
      {
        sectionId: 'korbanot',
        order: 2,
      },
      {
        sectionId: 'hodu',
        order: 3,
      },
      {
        sectionId: 'yishtabach',
        order: 4,
      },
    ]),
  },
  {
    id: 'mincha',
    titleKey: 'presets.mincha.title',
    order: 2,
    sections: sortSections([
      {
        sectionId: 'korbanot',
        order: 1,
      },
      {
        sectionId: 'ashrei',
        order: 2,
      },
    ]),
  },
  {
    id: 'birkat-hamazon',
    titleKey: 'presets.birkatHamazon.title',
    order: 3,
    sections: sortSections([
      {
        sectionId: 'birkat-hamazon',
        order: 1,
      },
    ]),
  },
  {
    id: 'tefilat-haderech',
    titleKey: 'presets.tefilatHaderech.title',
    order: 4,
    sections: sortSections([
      {
        sectionId: 'tefilat-haderech',
        order: 1,
      },
    ]),
  },
  {
    id: 'maariv',
    titleKey: 'presets.maariv.title',
    order: 5,
    sections: sortSections([
      {
        sectionId: 'maariv-main',
        order: 1,
      },
    ]),
  },
  {
    id: 'kriat-shema-al-hamita',
    titleKey: 'presets.kriatShemaAlHamita.title',
    order: 6,
    sections: sortSections([
      {
        sectionId: 'kriat-shema-al-hamita',
        order: 1,
      },
    ]),
  },
];
