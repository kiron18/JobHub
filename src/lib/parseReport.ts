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
