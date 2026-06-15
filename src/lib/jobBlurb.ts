// One-line, ~120-char preview of a job description for a card. Never shows the
// full posting (the full text is reserved for generation).
export function jobBlurb(description: string | null | undefined, max = 120): string {
  if (!description) return '';
  const oneLine = description.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max).trimEnd() + '…';
}
