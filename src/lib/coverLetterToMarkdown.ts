import type { CoverLetterData } from './coverLetterData';

/**
 * coverLetterToMarkdown — deterministic markdown renderer for cover letters.
 *
 * Output guarantee: blank line between every paragraph, salutation/signoff on
 * their own lines, no glued formatting.
 *
 * The LLM writes prose for fixed slots; code owns paragraph structure.
 */
export function coverLetterToMarkdown(d: CoverLetterData): string {
  const lines: string[] = [];

  // Salutation — always on its own line
  lines.push(d.salutation);
  lines.push('');

  // Paragraph 1 — opening hook + company connection
  lines.push(d.p1.trim());
  lines.push('');

  // Paragraph 2 — strongest evidence with metric
  lines.push(d.p2.trim());
  lines.push('');

  // Paragraph 3 — bridge + second evidence
  lines.push(d.p3.trim());
  lines.push('');

  // Paragraph 4 — enthusiasm + CTA
  lines.push(d.p4.trim());
  lines.push('');

  // Signoff — always on its own line
  lines.push(d.signoff.trim());

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
