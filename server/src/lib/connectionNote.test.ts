import { describe, it, expect } from 'vitest';
import { clampConnectionNote, CONNECTION_NOTE_LIMIT } from './connectionNote';

describe('clampConnectionNote', () => {
  it('leaves a note under the limit alone', () => {
    expect(clampConnectionNote('Hi Priya, would be good to connect.')).toBe('Hi Priya, would be good to connect.');
  });

  it('drops whole trailing sentences to fit', () => {
    const note = 'Hi Priya, saw your work on self-serve analytics dashboards for product teams at Atlassian. '
      + "I'm a data analyst working with SQL, Python and Power BI, exploring roles in Sydney. Would be good to connect.";
    const out = clampConnectionNote(note);
    expect(out.length).toBeLessThanOrEqual(CONNECTION_NOTE_LIMIT);
    expect(out.endsWith('.')).toBe(true);
    expect(out.startsWith('Hi Priya')).toBe(true);
  });

  it('cuts at a word, never mid-word, when one sentence is too long', () => {
    const out = clampConnectionNote('word '.repeat(80).trim());
    expect(out.length).toBeLessThanOrEqual(CONNECTION_NOTE_LIMIT);
    expect(out).toMatch(/word\.$/);
  });
});
