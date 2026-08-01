import { describe, it, expect } from 'vitest';
import { parseResume } from '../resumeStructure';

/**
 * Whatever a person writes in the editor has to come out the other side.
 *
 * These cover the silent-loss bugs: content typed under a heading was dropped
 * while the heading itself still printed, so it looked like a rendering glitch
 * rather than text going missing. A user has no way to notice that.
 */
describe('parseResume — user-written sections must never be dropped', () => {
  const bullets = (s: { content: Array<{ bullets?: string[] }> }) =>
    s.content.flatMap(i => i.bullets ?? []);
  const texts = (s: { content: Array<{ text?: string }> }) =>
    s.content.map(i => i.text).filter(Boolean);

  it('keeps bullets written straight under a heading, with no ### entry', () => {
    // The reported bug: "Additional Experience" printed, its bullets did not.
    const parsed = parseResume([
      '## Additional Experience',
      '- Volunteered at the community centre for two years',
      '- Won multiple awards for quality of service',
    ].join('\n'));

    const section = parsed.find(s => s.title === 'Additional Experience')!;
    expect(bullets(section)).toEqual([
      'Volunteered at the community centre for two years',
      'Won multiple awards for quality of service',
    ]);
  });

  it('keeps bullets under a section nobody anticipated', () => {
    const parsed = parseResume('## Hobbies\n- Long distance running\n- Surf lifesaving');
    const section = parsed.find(s => s.title === 'Hobbies')!;
    expect(section.type).toBe('other');
    expect(bullets(section)).toEqual(['Long distance running', 'Surf lifesaving']);
  });

  it('keeps plain prose under an invented heading', () => {
    // Only 'summary' used to retain loose text; everything else discarded it.
    const parsed = parseResume('## Interests\nReading and hiking on weekends.');
    const section = parsed.find(s => s.title === 'Interests')!;
    expect(texts(section)).toEqual(['Reading and hiking on weekends.']);
  });

  it('still attaches bullets to the ### entry above them when there is one', () => {
    const parsed = parseResume([
      '## Professional Experience',
      '### Water Operator | City Water',
      'Jan 2022 - Present',
      '- Ran the plant',
      '- Monitored SCADA',
    ].join('\n'));

    const section = parsed.find(s => s.title === 'Professional Experience')!;
    expect(section.content).toHaveLength(1);      // one entry, not two
    expect(bullets(section)).toEqual(['Ran the plant', 'Monitored SCADA']);
  });

  it('handles a section that mixes loose bullets and a proper entry', () => {
    const parsed = parseResume([
      '## Additional Experience',
      '- A loose bullet before any entry',
      '### Volunteer | Community Centre',
      '2020 - 2022',
      '- A bullet belonging to the entry',
    ].join('\n'));

    const section = parsed.find(s => s.title === 'Additional Experience')!;
    expect(bullets(section)).toEqual([
      'A loose bullet before any entry',
      'A bullet belonging to the entry',
    ]);
  });

  it('loses nothing across a whole resume with invented sections', () => {
    const md = [
      '# Jane Smith', 'jane@example.com', '',
      '## Professional Summary', 'Water treatment operator with six years of experience.', '',
      '## Professional Experience', '### Water Operator | City Water', 'Jan 2022 - Present',
      '- Ran the plant', '',
      '## Additional Experience', '- Volunteered at the community centre', '',
      '## Hobbies', '- Long distance running', '',
      '## Interests', 'Reading and hiking on weekends.',
    ].join('\n');

    const parsed = parseResume(md);
    const everything = parsed.flatMap(s => [...bullets(s as never), ...texts(s as never)]).join(' | ');

    for (const written of [
      'Ran the plant',
      'Volunteered at the community centre',
      'Long distance running',
      'Reading and hiking on weekends.',
      'Water treatment operator with six years of experience.',
    ]) {
      expect(everything).toContain(written);
    }
  });
});
