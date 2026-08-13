/**
 * The post-workshop diagnostic: the thing attendees are promised in the room and
 * receive within the hour.
 *
 * This is assembly, not new analysis. runCvGapScan and runRoadmap already do the
 * hard part; what happens here is choosing which of their outputs a person
 * actually sees, and refusing to show the ones we cannot stand behind.
 */
import { detectAtsStructure, analyzeRawTextLayout, type AtsStructure } from '../lib/atsStructure';
import {
  runCvGapScan,
  runRoadmap,
  splitBulletLines,
  dutyOpeningCount,
  quantificationRatio,
  type CvGapResult,
  type RoadmapStep,
  type CulturalTranslation,
} from './cvGapScan';

/** How many roadmap steps arrive whole. The rest show the action, not the why. */
export const OPEN_ROADMAP_STEPS = 3;

export interface GapReport {
  version: 1;
  generatedAt: string;
  firstName: string;
  inferredRole: string;
  firstImpression: string;
  reassurance: string;
  hiringManager: { name: string; archetype: string; view: string } | null;

  /** The exhibit. Null when nothing survived verification, which is a real outcome. */
  translation: CulturalTranslation | null;
  /** Duty-led lines left unfixed after the one shown. Counted, never claimed. */
  withheldCount: number;

  metrics: {
    atsRisk: boolean;
    atsReasons: string[];
    dutyBullets: number;
    totalBullets: number;
    quantifiedBullets: number;
    keywordsPresent: number;
    keywordsExpected: number;
    keywordsMissing: string[];
  };

  items: { severity: 'critical' | 'warning' | 'good'; text: string }[];
  roadmap: { rank: number; title: string; why: string | null }[];
}

// ── The figure gate ──────────────────────────────────────────────────────────

/**
 * Numbers written as words, because the scan prompt bans nothing about how a
 * figure is spelled and the model uses both forms freely.
 */
const WORD_NUMBERS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15',
  twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60',
  hundred: '100', thousand: '1000',
};

/** Every quantity a rewrite asserts, normalised to digits. */
export function figuresIn(text: string): string[] {
  const found: string[] = [];

  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const normalised = m[0].replace(/,/g, '').replace(/\.0+$/, '');
    if (normalised) found.push(normalised);
  }
  for (const m of text.toLowerCase().matchAll(/[a-z]+/g)) {
    const digit = WORD_NUMBERS[m[0]];
    if (digit) found.push(digit);
  }

  return [...new Set(found)];
}

/**
 * Is every quantity in this rewrite actually present in the resume it claims to
 * be rewriting?
 *
 * ⚠️ THIS IS THE INTEGRITY GATE. `instead` is model-written prose, and a
 * rewritten bullet reading "cut the reporting cycle from four hours to twenty
 * minutes" is enormously more persuasive than the truth when the model invented
 * those numbers. This report is a sales asset sent to someone deciding whether
 * to trust us with $750, and it quotes their own resume back at them: an
 * invented metric is the single fastest way to destroy that. So a rewrite is
 * shown only when every figure in it already appears in the source document.
 *
 * Deliberately strict rather than clever. A false rejection costs one good
 * exhibit; a false acceptance costs the sale and the reputation.
 */
export function rewriteFiguresAreGrounded(instead: string, resumeText: string): boolean {
  const haystack = figuresIn(resumeText);
  return figuresIn(instead).every((f) => haystack.includes(f));
}

/**
 * The one line the report shows fixed. The first translation whose figures check
 * out, or null when none do.
 */
export function pickVerifiedTranslation(
  translations: CulturalTranslation[] | undefined,
  resumeText: string,
): CulturalTranslation | null {
  for (const t of translations ?? []) {
    if (!t?.wrote?.trim() || !t?.instead?.trim()) continue;
    // The quoted "before" must really be theirs, or the whole exhibit is a lie
    // regardless of how good the rewrite is.
    if (!resumeText.toLowerCase().includes(t.wrote.trim().toLowerCase().slice(0, 40))) continue;
    if (!rewriteFiguresAreGrounded(t.instead, resumeText)) {
      console.warn('[gapReport] rejected a rewrite for an ungrounded figure:', t.instead.slice(0, 90));
      continue;
    }
    return t;
  }
  return null;
}

// ── Assembly ─────────────────────────────────────────────────────────────────

async function readAtsStructure(
  resumeText: string,
  file: Buffer | null,
  mimetype: string | null,
  filename: string | null,
): Promise<AtsStructure> {
  if (file && file.length) {
    try {
      return await detectAtsStructure(file, mimetype ?? '', filename ?? '', resumeText);
    } catch (err) {
      console.warn('[gapReport] structural inspection failed, falling back to text-only', err);
    }
  }
  // Registrations taken before the bytes were kept, and anything that failed to
  // inspect. Conservative by design: it only reports what the text alone proves.
  const reasons = analyzeRawTextLayout(resumeText);
  return { risk: reasons.length > 0, reasons };
}

export async function buildGapReport(input: {
  resumeText: string;
  resumeFile?: Buffer | null;
  resumeMimetype?: string | null;
  resumeFilename?: string | null;
  registeredName: string;
}): Promise<GapReport> {
  const { resumeText, registeredName } = input;

  const ats = await readAtsStructure(
    resumeText,
    input.resumeFile ?? null,
    input.resumeMimetype ?? null,
    input.resumeFilename ?? null,
  );

  const scan: CvGapResult = await runCvGapScan(resumeText, ats);

  // Their registration name wins over the one parsed out of the resume: they
  // typed it themselves and confirmed it, so it is the one they answer to.
  const firstName =
    registeredName.trim().split(/\s+/)[0] || scan.firstName || '';

  const roadmapSteps: RoadmapStep[] = await runRoadmap(resumeText, firstName);

  const translation = pickVerifiedTranslation(scan.culturalTranslations, resumeText);

  // Counted from the document, not asserted. The line "there are N more like
  // this" is the whole sale, and it only survives contact with a sceptical
  // reader because N is real. One is subtracted for the one shown fixed.
  const bullets = splitBulletLines(resumeText);
  const dutyBullets = dutyOpeningCount(bullets);
  const withheldCount = Math.max(0, dutyBullets - (translation ? 1 : 0));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    firstName,
    inferredRole: scan.inferredRole,
    firstImpression: scan.firstImpression ?? '',
    reassurance: scan.reassurance ?? '',
    hiringManager: scan.hiringManager ?? null,
    translation,
    withheldCount,
    metrics: {
      atsRisk: scan.atsRisk ?? ats.risk,
      atsReasons: scan.atsReasons ?? ats.reasons,
      dutyBullets,
      totalBullets: bullets.length,
      quantifiedBullets: Math.round(quantificationRatio(bullets) * bullets.length),
      keywordsPresent: scan.keywordsPresent ?? 0,
      keywordsExpected: scan.keywordsExpected ?? 0,
      keywordsMissing: scan.keywordsMissing ?? [],
    },
    // `evidence` is deliberately dropped: it is the raw resume snippet behind
    // each verdict and exists for our accuracy checks, not for the reader.
    items: scan.items.map((i) => ({ severity: i.severity, text: i.text })),
    roadmap: roadmapSteps.map((s, idx) => ({
      rank: s.rank ?? idx + 1,
      title: s.title,
      why: idx < OPEN_ROADMAP_STEPS ? s.why : null,
    })),
  };
}
