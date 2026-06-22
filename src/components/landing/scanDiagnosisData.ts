// Pure view-model for the four-gauge diagnosis. No side effects, no I/O.

export type RelevanceBucket = 'strong' | 'partial' | 'weak';

export interface ScanInput {
  firstName?: string;
  items?: { severity: 'critical' | 'warning' | 'good'; text: string }[];
  culturalTranslations?: { wrote: string; reads: string; instead: string }[];
  atsRisk?: boolean;
  atsReasons?: string[];
  dutyBullets?: number;
  totalBullets?: number;
  keywordsExpected?: number;
  keywordsPresent?: number;
  keywordsMissing?: string[];
}

export interface GaugeModel {
  firstName: string;
  atsPass: boolean;
  atsReasons: string[];
  dutyBullets: number;
  totalBullets: number;
  outcomeFill: number;        // 0..1, the GOOD portion (outcome-led bullets)
  relevanceBucket: RelevanceBucket;
  relevanceFill: number;      // 0..1
  keywordsMissing: string[];
  presentationItems: string[];
  presentationCount: number;
  flipPairs: { wrote: string; instead: string }[];
}

// Items that belong to ATS or keyword gauges, excluded from the presentation count.
const ATS_OR_KEYWORD = /\b(ats|machine|keyword|text box|table|column|parse|scan|single-column)\b/i;

export function buildGaugeModel(r: ScanInput): GaugeModel {
  const dutyBullets = r.dutyBullets ?? 0;
  const totalBullets = r.totalBullets ?? 0;
  const outcomeFill = totalBullets > 0 ? (totalBullets - dutyBullets) / totalBullets : 1;

  const expected = r.keywordsExpected ?? 0;
  const present = r.keywordsPresent ?? 0;
  const relevanceFill = expected > 0 ? present / expected : 0.5;
  const relevanceBucket: RelevanceBucket =
    relevanceFill >= 0.7 ? 'strong' : relevanceFill >= 0.4 ? 'partial' : 'weak';

  const presentationItems = (r.items ?? [])
    .filter(i => i.severity !== 'good' && !ATS_OR_KEYWORD.test(i.text))
    .map(i => i.text);

  const flipPairs = (r.culturalTranslations ?? [])
    .filter(t => t.wrote && t.instead)
    .map(t => ({ wrote: t.wrote, instead: t.instead }));

  return {
    firstName: r.firstName ?? '',
    atsPass: !(r.atsRisk ?? false),
    atsReasons: r.atsReasons ?? [],
    dutyBullets,
    totalBullets,
    outcomeFill: Math.max(0, Math.min(1, outcomeFill)),
    relevanceBucket,
    relevanceFill: Math.max(0, Math.min(1, relevanceFill)),
    keywordsMissing: r.keywordsMissing ?? [],
    presentationItems,
    presentationCount: presentationItems.length,
    flipPairs,
  };
}
