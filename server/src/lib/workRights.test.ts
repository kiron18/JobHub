import { describe, it, expect } from 'vitest';
import { detectWorkRights } from './workRights';

describe('detectWorkRights — says what the ad asks, and nothing more', () => {
  it('returns nothing for an ad that never raises it', () => {
    expect(detectWorkRights('We are looking for a data analyst with three years of SQL.')).toBeNull();
  });

  it('reads a citizenship requirement', () => {
    const n = detectWorkRights('- Applicants must be an Australian citizen at the time of application');
    expect(n?.sentence).toBe('This ad asks for Australian citizenship.');
    expect(n?.kinds).toEqual(['citizenship']);
  });

  it('reads permanent residency', () => {
    const n = detectWorkRights('You will need permanent residency to be considered.');
    expect(n?.sentence).toBe('This ad asks for permanent residency.');
  });

  it('treats "Australian residency" as the same ask', () => {
    expect(detectWorkRights('Australian residency required')?.kinds).toContain('permanent-residency');
  });

  it('joins two asks into one readable sentence', () => {
    const n = detectWorkRights('Australian citizenship or permanent residency is required for this role.');
    expect(n?.sentence).toBe('This ad asks for Australian citizenship or permanent residency.');
  });

  it('joins three with commas', () => {
    const n = detectWorkRights(
      'Australian citizens, permanent residents, or those with full working rights may apply.',
    );
    expect(n?.sentence).toBe(
      'This ad asks for Australian citizenship, permanent residency, or full working rights in Australia.',
    );
  });

  it('reads a security clearance, which gates the same people', () => {
    const n = detectWorkRights('A baseline security clearance is required.');
    expect(n?.sentence).toBe('This ad asks for a government security clearance.');
  });

  it('catches the ad ruling out sponsorship, which is the same fact backwards', () => {
    const n = detectWorkRights('Please note we are unable to offer visa sponsorship for this position.');
    expect(n?.noSponsorship).toBe(true);
    expect(n?.sentence).toBe('It also states that visa sponsorship is not available.');
  });

  it('states both when the ad says both', () => {
    const n = detectWorkRights(
      'Australian citizenship is required. We do not sponsor visas.',
    );
    expect(n?.sentence).toBe(
      'This ad asks for Australian citizenship. It also states that visa sponsorship is not available.',
    );
  });

  // The sentence is shown to someone who may well hold none of these. It states
  // the requirement and stops, because this file does not know their status.
  it('never tells them whether to apply', () => {
    const n = detectWorkRights('Australian citizenship required. No sponsorship available.');
    expect(n!.sentence).not.toMatch(/you |your |apply|eligib|unfortunat|cannot|do not/i);
  });

  it('does not fire on the letters PR inside an ordinary word', () => {
    expect(detectWorkRights('Experience with PR campaigns and media relations.')).toBeNull();
    expect(detectWorkRights('Reporting to the Project Manager.')).toBeNull();
  });

  it('does not fire on a resume that merely mentions Australia', () => {
    expect(detectWorkRights('Worked in Australia for two years as a resident engineer.')).toBeNull();
  });

  it('survives an empty ad', () => {
    expect(detectWorkRights('')).toBeNull();
    expect(detectWorkRights(undefined as unknown as string)).toBeNull();
  });
});
