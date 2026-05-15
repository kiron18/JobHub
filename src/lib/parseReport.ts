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
  action: string;
}

export interface FixMoves {
  targeting: Move;
  resume: Move;
  applications: Move;
}

const MOVE_FALLBACK: Move = {
  action: 'Take one focused step on this part of your application today.',
};

const MOVE_KEYS: Array<{ marker: string; field: keyof FixMoves }> = [
  { marker: 'MOVE_TARGETING',    field: 'targeting' },
  { marker: 'MOVE_RESUME',       field: 'resume' },
  { marker: 'MOVE_APPLICATIONS', field: 'applications' },
];

/**
 * Strip stray markdown bold markers (LLMs sometimes wrap labels or values in **).
 */
function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^[*_]+|[*_]+$/g, '').trim();
}

/**
 * Extract the ACTION line from one MOVE block. Tolerant of "**ACTION:**"
 * wrapping and of multi-line values. Returns undefined if no ACTION found.
 */
function extractAction(block: string): string | undefined {
  // Optional ** before/after the label, then the value up to the next ACTION
  // label or end-of-block.
  const re = /\*?\*?ACTION\*?\*?:\s*\*?\*?([\s\S]*?)(?=\n\s*\*?\*?ACTION\*?\*?:|$)/i;
  const m = block.match(re);
  if (!m) return undefined;
  const value = stripMarkdown(m[1].replace(/\s+/g, ' ').trim());
  return value || undefined;
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
    // Each move block starts at "### MOVE_X" (with optional ** wrapping) and
    // ends at the next "### MOVE_" or end-of-string.
    const blockRe = new RegExp(
      `###\\s*\\*?\\*?${marker}\\*?\\*?\\s*\\n([\\s\\S]*?)(?=\\n###\\s*\\*?\\*?MOVE_|$)`,
      'i',
    );
    const blockMatch = fixSectionContent.match(blockRe);
    if (!blockMatch) {
      console.warn(`[parseFixMoves] Missing block: ${marker}. Using fallback.`);
      continue;
    }
    const action = extractAction(blockMatch[1]);
    if (!action) {
      console.warn(`[parseFixMoves] No ACTION in ${marker}. Using fallback.`);
      continue;
    }
    result[field] = { action };
  }

  return result;
}
