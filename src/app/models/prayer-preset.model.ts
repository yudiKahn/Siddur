export type PrayerConditionRuleId =
  | 'show-tachanun'
  | 'show-hallel-any'
  | 'show-hallel-full'
  | 'show-hallel-partial';

export type HallelMode = 'none' | 'partial' | 'full';

export interface PrayerTimingFlags {
  tachanun: boolean;
  hallel: HallelMode;
}

export interface PrayerPageSegment {
  startPage: number;
  endPage: number;
  includeWhen?: PrayerConditionRuleId;
}

export interface PrayerSectionDefinition {
  id: string;
  titleKey: string;
  segments: PrayerPageSegment[];
}

export interface PrayerPresetSectionRef {
  sectionId: string;
  order: number;
  titleKey?: string;
  includeWhen?: PrayerConditionRuleId;
}

export interface PrayerPresetDefinition {
  id: string;
  titleKey: string;
  order: number;
  sections: PrayerPresetSectionRef[];
}

export interface ResolvedPrayerPage {
  id: string;
  pageNumber: number;
  sequenceIndex: number;
  sectionId: string;
}

export interface ResolvedPrayerSection {
  id: string;
  titleKey: string;
  order: number;
  segments: PrayerPageSegment[];
  pageNumbers: number[];
  firstPage: number;
  firstSequenceIndex: number;
}

export interface ResolvedPrayerPreset {
  id: string;
  titleKey: string;
  order: number;
  sections: ResolvedPrayerSection[];
  pages: ResolvedPrayerPage[];
  initialPage: number;
}

export interface PrayerPresetSummary {
  id: string;
  titleKey: string;
  order: number;
  initialPage: number;
  sections: ResolvedPrayerSection[];
}
