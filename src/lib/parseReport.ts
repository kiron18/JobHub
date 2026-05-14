export interface ReportSection {
  key: string;
  title: string;
  content: string;
}

/** Strip em dashes from text, replacing with comma+space or space */
function stripEmDash(text: string): string {
  return text.replace(/ — /g, ', ').replace(/—/g, ' ');
}

/**
 * Split a diagnostic markdown report into its 6 named sections.
 * Returns an array in the order they appear in the document.
 */
export function parseReportSections(markdown: string): ReportSection[] {
  if (!markdown) return [];
  // Split on ## headings
  const chunks = markdown.split(/\n(?=##\s)/);
  return chunks
    .filter(c => c.trim().startsWith('##'))
    .map(chunk => {
      const lines = chunk.trim().split('\n');
      const heading = lines[0].replace(/^##\s*/, '').trim();
      const body = stripEmDash(lines.slice(1).join('\n').trim());
      return { key: headingToKey(heading), title: heading, content: body };
    })
    .filter(s => s.key !== 'unknown');
}

function headingToKey(heading: string): string {
  const h = heading.toLowerCase();
  if (h.includes('target')) return 'targeting';
  if (h.includes('document') || h.includes('audit')) return 'document_audit';
  if (h.includes('pipeline')) return 'pipeline';
  if (h.includes('honest')) return 'honest';
  if (h.includes('fix') || h.includes('step')) return 'fix';
  if (h.includes('jobhub') || h.includes('what')) return 'what_jobhub_does';
  return 'unknown';
}

/**
 * Split a section's content into problem text and fix text.
 * Fix text starts after the first "---" separator or "Fix:" heading within the section.
 */
export function splitProblemFix(content: string): { problem: string; fix: string } {
  const sep = content.indexOf('\n---\n');
  if (sep !== -1) {
    return {
      problem: content.slice(0, sep).trim(),
      fix: content.slice(sep + 5).trim(),
    };
  }
  // Fallback: split at 60% of content
  const mid = Math.floor(content.length * 0.6);
  const breakAt = content.indexOf('\n', mid);
  if (breakAt === -1) return { problem: content, fix: '' };
  return {
    problem: content.slice(0, breakAt).trim(),
    fix: content.slice(breakAt).trim(),
  };
}

export interface Move {
  headline: string;
  situation: string;
  jobhub: string;
  outcome: string;
}

export interface FixMoves {
  targeting: Move;
  resume: Move;
  applications: Move;
}

const MOVE_FALLBACK: Move = {
  headline: 'A move tailored to your situation',
  situation: 'Here is how we would approach this part for your situation.',
  jobhub: 'JobHub guides you through this step using your profile.',
  outcome: 'You move forward with a clear next action.',
};

const MOVE_KEYS: Array<{ marker: string; field: keyof FixMoves }> = [
  { marker: 'MOVE_TARGETING',    field: 'targeting' },
  { marker: 'MOVE_RESUME',       field: 'resume' },
  { marker: 'MOVE_APPLICATIONS', field: 'applications' },
];

/**
 * Extract one labelled value (e.g. "HEADLINE: foo") from a block of MOVE text.
 * Tolerant: returns undefined if missing. Stops at the next ALL-CAPS label
 * line so multi-line values are captured up to the next field.
 */
function extractField(block: string, label: 'HEADLINE' | 'SITUATION' | 'JOBHUB' | 'OUTCOME'): string | undefined {
  const re = new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]{4,}:|$)`, 'm');
  const m = block.match(re);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * Split the Section 5 markdown ("## The 3-Step Fix" content) into three
 * structured Move objects. Tolerant: any missing or malformed block falls
 * back to a generic placeholder and a warning is logged. The diagnostic
 * still renders.
 */
export function parseFixMoves(fixSectionContent: string): FixMoves {
  const result: FixMoves = {
    targeting: { ...MOVE_FALLBACK },
    resume: { ...MOVE_FALLBACK },
    applications: { ...MOVE_FALLBACK },
  };

  for (const { marker, field } of MOVE_KEYS) {
    // Each move block starts at "### MOVE_X" and ends at the next "###" or end-of-string.
    const blockRe = new RegExp(`###\\s*${marker}\\s*\\n([\\s\\S]*?)(?=\\n###\\s*MOVE_|$)`, 'i');
    const blockMatch = fixSectionContent.match(blockRe);
    if (!blockMatch) {
      console.warn(`[parseFixMoves] Missing block: ${marker}. Using fallback.`);
      continue;
    }
    const block = blockMatch[1];

    const headline = extractField(block, 'HEADLINE');
    const situation = extractField(block, 'SITUATION');
    const jobhub = extractField(block, 'JOBHUB');
    const outcome = extractField(block, 'OUTCOME');

    if (!headline || !situation || !jobhub || !outcome) {
      console.warn(`[parseFixMoves] Incomplete block ${marker}. Falling back where missing.`, {
        headline: !!headline, situation: !!situation, jobhub: !!jobhub, outcome: !!outcome,
      });
    }

    result[field] = {
      headline: headline ?? MOVE_FALLBACK.headline,
      situation: situation ?? MOVE_FALLBACK.situation,
      jobhub: jobhub ?? MOVE_FALLBACK.jobhub,
      outcome: outcome ?? MOVE_FALLBACK.outcome,
    };
  }

  return result;
}
