import { Injectable, inject } from '@angular/core';
import { PRAYER_PRESETS } from '../data/prayer-presets.data';
import { PRAYER_SECTIONS } from '../data/prayer-sections.data';
import {
  PrayerConditionRuleId,
  PrayerPageSegment,
  PrayerPresetDefinition,
  PrayerPresetSummary,
  PrayerPresetSectionRef,
  PrayerSectionDefinition,
  PrayerTimingFlags,
  ResolvedPrayerPage,
  ResolvedPrayerPreset,
  ResolvedPrayerSection,
} from '../models/prayer-preset.model';
import { PrayerTimingService } from './prayer-timing.service';

const sortSections = (sections: PrayerPresetSectionRef[]): PrayerPresetSectionRef[] =>
  [...sections].sort((left, right) => left.order - right.order);

const expandSegmentPages = (segment: PrayerPageSegment): number[] => {
  const pages: number[] = [];

  for (let pageNumber = segment.startPage; pageNumber <= segment.endPage; pageNumber += 1) {
    pages.push(pageNumber);
  }

  return pages;
};

@Injectable({
  providedIn: 'root',
})
export class PrayerPresetsService {
  private readonly prayerTimingService = inject(PrayerTimingService);

  getAll(): PrayerPresetSummary[] {
    const flags = this.prayerTimingService.getCurrentFlags();

    return [...PRAYER_PRESETS]
      .sort((left, right) => left.order - right.order)
      .map((preset) => this.resolvePreset(preset, flags))
      .filter((preset): preset is ResolvedPrayerPreset => preset !== undefined)
      .map((preset) => ({
        id: preset.id,
        titleKey: preset.titleKey,
        order: preset.order,
        initialPage: preset.initialPage,
        sections: preset.sections,
      }));
  }

  getById(id: string): ResolvedPrayerPreset | undefined {
    const preset = PRAYER_PRESETS.find((entry) => entry.id === id);
    if (!preset) {
      return undefined;
    }

    return this.resolvePreset(preset, this.prayerTimingService.getCurrentFlags());
  }

  private resolvePreset(
    presetDefinition: PrayerPresetDefinition,
    flags: PrayerTimingFlags,
  ): ResolvedPrayerPreset | undefined {
    const resolvedSections = sortSections(presetDefinition.sections)
      .map((sectionRef) => this.resolveSection(sectionRef, flags))
      .filter((section): section is Omit<ResolvedPrayerSection, 'firstSequenceIndex'> => section !== undefined);

    if (!resolvedSections.length) {
      return undefined;
    }

    const pages: ResolvedPrayerPage[] = [];
    const sections: ResolvedPrayerSection[] = resolvedSections.map((section) => {
      const firstSequenceIndex = pages.length;

      section.pageNumbers.forEach((pageNumber, pageOffset) => {
        pages.push({
          id: `${section.id}-${firstSequenceIndex + pageOffset}-${pageNumber}`,
          pageNumber,
          sequenceIndex: firstSequenceIndex + pageOffset,
          sectionId: section.id,
        });
      });

      return {
        ...section,
        firstSequenceIndex,
      };
    });

    return {
      id: presetDefinition.id,
      titleKey: presetDefinition.titleKey,
      order: presetDefinition.order,
      sections,
      pages,
      initialPage: pages[0].pageNumber,
    };
  }

  private resolveSection(
    sectionRef: PrayerPresetSectionRef,
    flags: PrayerTimingFlags,
  ): Omit<ResolvedPrayerSection, 'firstSequenceIndex'> | undefined {
    if (!this.matchesRule(sectionRef.includeWhen, flags)) {
      return undefined;
    }

    const sectionDefinition = this.getSectionDefinition(sectionRef.sectionId);
    if (!sectionDefinition) {
      throw new Error(`Unknown prayer section: ${sectionRef.sectionId}`);
    }

    const segments = sectionDefinition.segments.filter((segment) =>
      this.matchesRule(segment.includeWhen, flags),
    );

    const pageNumbers = segments.reduce<number[]>(
      (pages, segment) => [...pages, ...expandSegmentPages(segment)],
      [],
    );
    if (!pageNumbers.length) {
      return undefined;
    }

    return {
      id: sectionDefinition.id,
      titleKey: sectionRef.titleKey ?? sectionDefinition.titleKey,
      order: sectionRef.order,
      segments,
      pageNumbers,
      firstPage: pageNumbers[0],
    };
  }

  private matchesRule(
    ruleId: PrayerConditionRuleId | undefined,
    flags: PrayerTimingFlags,
  ): boolean {
    if (!ruleId) {
      return true;
    }

    switch (ruleId) {
      case 'show-tachanun':
        return flags.tachanun;
      case 'show-hallel-any':
        return flags.hallel !== 'none';
      case 'show-hallel-full':
        return flags.hallel === 'full';
      case 'show-hallel-partial':
        return flags.hallel === 'partial';
      default:
        return true;
    }
  }

  private getSectionDefinition(sectionId: string): PrayerSectionDefinition | undefined {
    return PRAYER_SECTIONS.find((section) => section.id === sectionId);
  }
}
