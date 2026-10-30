/**
 * LinkedIn's cap on a connection-request note for a free account. Premium gets
 * 300, but the page promises every note "sends either way", so 200 is the line.
 */
export const CONNECTION_NOTE_LIMIT = 200;

/**
 * The last resort when a note is still too long after the model has been asked
 * to shorten it: keep whole sentences up to the limit, or failing that whole
 * words, so what is left still reads as a note and never stops mid-word.
 */
export function clampConnectionNote(note: string, limit = CONNECTION_NOTE_LIMIT): string {
  const text = note.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let kept = '';
  for (const s of sentences) {
    if ((kept + s).trim().length > limit) break;
    kept += s;
  }
  if (kept.trim().length >= limit * 0.5) return kept.trim();
  const cut = text.slice(0, limit - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '.';
}
