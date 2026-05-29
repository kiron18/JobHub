import type { CoverLetterData } from './coverLetterData';

export function coverLetterToMarkdown(d: CoverLetterData): string {
  const lines: string[] = [];
  lines.push(d.salutation);
  lines.push('');
  lines.push(d.p1.trim());
  lines.push('');
  lines.push(d.p2.trim());
  lines.push('');
  lines.push(d.p3.trim());
  lines.push('');
  lines.push(d.p4.trim());
  lines.push('');
  lines.push(d.signoff.trim());
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
