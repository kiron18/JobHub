import { describe, it, expect } from 'vitest';
import { replaceLine, insertLine, removeLine, describeEdit } from './bankEdit';

const DOC = [
  '# Jane Smith',
  'Marketing Coordinator',
  '',
  '## Work Experience',
  '**Marketing Coordinator | Retail Group**',
  'Feb 2023 - Present',
  '- Increased conversion by 20% across the campaign',
  '- Managed a team of 4',
  '',
  '## Education',
  '- Bachelor of Business, Western Sydney University',
].join('\n');

describe('replaceLine', () => {
  it('fixes a wrong figure and changes nothing else', () => {
    const r = replaceLine(DOC, '- Increased conversion by 20% across the campaign', '- Increased conversion by 16% across the campaign');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('16%');
    expect(r.text).not.toContain('20%');
    // Every other line survives byte for byte.
    expect(r.text.split('\n').length).toBe(DOC.split('\n').length);
    expect(r.text.split('\n').filter((l, i) => l !== DOC.split('\n')[i]).length).toBe(1);
  });

  it('refuses when the line is not there — the client has stale text', () => {
    const r = replaceLine(DOC, '- A line that does not exist', '- anything');
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('not_found');
    expect(r.text).toBe(DOC);                    // document untouched
    expect(r.message).toMatch(/reload/i);
  });

  it('refuses when the line appears twice — we cannot know which was meant', () => {
    const dup = `${DOC}\n- Managed a team of 4`;
    const r = replaceLine(dup, '- Managed a team of 4', '- Managed a team of 6');
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('ambiguous');
    expect(r.text).toBe(dup);
  });

  it('refuses an empty replacement', () => {
    const r = replaceLine(DOC, '- Managed a team of 4', '   ');
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('empty');
  });

  it('tolerates trailing whitespace differences on the target line', () => {
    // Editors and copy-paste routinely add or drop trailing spaces.
    const r = replaceLine(DOC, '- Managed a team of 4   ', '- Managed a team of 6');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('team of 6');
  });

  it('does not touch a line that merely contains the target as a substring', () => {
    const doc = '- Managed a team\n- Managed a team of 4';
    const r = replaceLine(doc, '- Managed a team', '- Led a team');
    expect(r.ok).toBe(true);
    expect(r.text).toBe('- Led a team\n- Managed a team of 4');
  });
});

describe('insertLine', () => {
  it('adds an achievement directly under the right role', () => {
    const r = insertLine(DOC, '- Launched the winter campaign, lifting signups', '- Increased conversion by 20% across the campaign');
    expect(r.ok).toBe(true);
    const l = r.text.split('\n');
    expect(l[7]).toBe('- Launched the winter campaign, lifting signups');
    expect(l[6]).toBe('- Increased conversion by 20% across the campaign');
    expect(l[8]).toBe('- Managed a team of 4');   // everything below shifted, nothing lost
    expect(l.length).toBe(DOC.split('\n').length + 1);
  });

  it('appends to the end when no anchor is given', () => {
    const r = insertLine(DOC, '- Certified in Google Analytics');
    expect(r.ok).toBe(true);
    expect(r.text.endsWith('- Certified in Google Analytics')).toBe(true);
    expect(r.text.startsWith(DOC)).toBe(true);    // original entirely intact
  });

  it('refuses when the anchor line is missing', () => {
    const r = insertLine(DOC, '- something', '- a line that is not there');
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('not_found');
    expect(r.text).toBe(DOC);
  });

  it('refuses an empty new line', () => {
    expect(insertLine(DOC, '  ').failure).toBe('empty');
  });
});

describe('removeLine', () => {
  it('removes exactly one line and leaves the rest identical', () => {
    const r = removeLine(DOC, '- Managed a team of 4');
    expect(r.ok).toBe(true);
    expect(r.text).not.toContain('Managed a team of 4');
    expect(r.text.split('\n').length).toBe(DOC.split('\n').length - 1);
    // Every surviving line is unchanged.
    const kept = DOC.split('\n').filter(l => l !== '- Managed a team of 4');
    expect(r.text.split('\n')).toEqual(kept);
  });

  it('refuses an ambiguous delete rather than guessing', () => {
    const dup = `${DOC}\n- Managed a team of 4`;
    const r = removeLine(dup, '- Managed a team of 4');
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('ambiguous');
    expect(r.text).toBe(dup);
  });

  it('refuses when the line is not there', () => {
    expect(removeLine(DOC, '- nope').failure).toBe('not_found');
  });
});

describe('the document is never corrupted', () => {
  it('a failed edit always returns the original document unchanged', () => {
    for (const r of [
      replaceLine(DOC, '- missing', '- x'),
      insertLine(DOC, '- x', '- missing'),
      removeLine(DOC, '- missing'),
      replaceLine(DOC, '- Managed a team of 4', ''),
    ]) {
      expect(r.ok).toBe(false);
      expect(r.text).toBe(DOC);
    }
  });

  it('a successful edit round-trips — undoing it restores the original exactly', () => {
    const edited = replaceLine(DOC, '- Managed a team of 4', '- Managed a team of 6');
    const undone = replaceLine(edited.text, '- Managed a team of 6', '- Managed a team of 4');
    expect(undone.text).toBe(DOC);
  });
});

describe('describeEdit', () => {
  it('states precisely what changed, so nobody has to re-read the document', () => {
    const edited = replaceLine(DOC, '- Managed a team of 4', '- Managed a team of 6').text;
    expect(describeEdit(DOC, edited)).toBe('Changed 1 line. Nothing else changed.');
    expect(describeEdit(DOC, insertLine(DOC, '- new').text)).toBe('Added 1 line. Nothing else changed.');
    expect(describeEdit(DOC, removeLine(DOC, '- Managed a team of 4').text)).toBe('Removed 1 line. Nothing else changed.');
    expect(describeEdit(DOC, DOC)).toBe('No change.');
  });
});
