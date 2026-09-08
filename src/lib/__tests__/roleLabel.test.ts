import { describe, it, expect } from 'vitest';
import { browseRoleLabel, stripRung, GENERIC_ROLE_LABEL, ROLE_BUDGET } from '../roleLabel';

describe('browseRoleLabel', () => {
  it('lowercases a badly-cased role — the bug that shipped', () => {
    // A real account had "BUsiness analyst", which printed verbatim.
    expect(browseRoleLabel('BUsiness analyst')).toBe('business analyst');
    expect(browseRoleLabel('Data Analyst')).toBe('data analyst');
  });

  it('leaves acronyms alone', () => {
    // "Browse it support jobs" is a worse bug than the one being fixed.
    expect(browseRoleLabel('IT Support')).toBe('IT support');
    expect(browseRoleLabel('HR Advisor')).toBe('HR advisor');
    expect(browseRoleLabel('UX Designer')).toBe('UX designer');
  });

  it('drops the rung so the button does not advertise internships', () => {
    expect(browseRoleLabel('Marketing Communications Intern')).toBe('marketing communications');
    expect(browseRoleLabel('Business Analyst Trainee')).toBe('business analyst');
  });

  it('drops a noun the surrounding sentence already says', () => {
    // "Browse data analyst jobs jobs".
    expect(browseRoleLabel('Data Analyst Jobs')).toBe('data analyst');
    expect(browseRoleLabel('Marketing Roles')).toBe('marketing');
  });

  it('drops a rung and a redundant noun together', () => {
    expect(browseRoleLabel('Data Analyst Intern Roles')).toBe('data analyst');
  });

  it('shortens from the left, keeping the craft', () => {
    // Head-final: the last words name the job, the leading ones qualify it.
    expect(browseRoleLabel('Marketing Communications and Engagement Officer'))
      .toBe('engagement officer');
    expect(browseRoleLabel('Senior Digital Marketing Campaign Manager'))
      .toBe('campaign manager');
  });

  it('prefers two words, and gives one up rather than overflow', () => {
    // Two words is the shape a label wants, and it keeps them whenever they
    // fit. Two words that do NOT fit the caller's stated room is a button that
    // runs off the side of the card, so the qualifier goes and the craft stays
    // — head-final, the same rule the trimming above follows. The search URL
    // is still built from the full stored role, so nothing is actually lost.
    expect(browseRoleLabel('Occupational Therapist')).toBe('occupational therapist');
    expect(browseRoleLabel('Telecommunications Administrator')).toBe('administrator');
    expect(browseRoleLabel('Occupational Therapist', ROLE_BUDGET.button)).toBe('therapist');
  });

  it('fits the button budget, which is the whole sentence and not just the role', () => {
    // "Browse ___ jobs" spends 12 characters before the role gets any. This is
    // the case that shipped a button 492px wide onto a 390px phone.
    const cases = [
      'Marketing Communications Intern',
      'Marketing Communications and Engagement Officer',
      'Senior Digital Marketing Campaign Manager',
      'Telecommunications Administrator',
      'Data Analyst',
      'AI Engineer',
    ];
    for (const role of cases) {
      const label = browseRoleLabel(role, ROLE_BUDGET.button);
      expect(label.length).toBeLessThanOrEqual(ROLE_BUDGET.button);
      expect(`Browse ${label} jobs`.length).toBeLessThanOrEqual(ROLE_BUDGET.button + 12);
    }
  });

  it('keeps the roomier budget where there is room', () => {
    expect(browseRoleLabel('Marketing Communications Intern', ROLE_BUDGET.row))
      .toBe('marketing communications');
    expect(browseRoleLabel('Marketing Communications Intern', ROLE_BUDGET.button))
      .toBe('communications');
  });

  it('leaves a label that already fits completely alone', () => {
    expect(browseRoleLabel('AI Engineer')).toBe('AI engineer');
    expect(browseRoleLabel('Registered Nurse')).toBe('registered nurse');
    expect(browseRoleLabel('Marketing Communications')).toBe('marketing communications');
  });

  it('falls back to a sentence that still reads', () => {
    expect(browseRoleLabel('')).toBe(GENERIC_ROLE_LABEL);
    expect(browseRoleLabel(null)).toBe(GENERIC_ROLE_LABEL);
    expect(browseRoleLabel(undefined)).toBe(GENERIC_ROLE_LABEL);
    expect(browseRoleLabel('   ')).toBe(GENERIC_ROLE_LABEL);
  });

  it('normalises stray whitespace', () => {
    expect(browseRoleLabel('  Data   Analyst  ')).toBe('data analyst');
  });
});

describe('stripRung', () => {
  it('takes the rung off without touching the case', () => {
    expect(stripRung('Marketing Communications Intern')).toBe('Marketing Communications');
    expect(stripRung('Business Analyst Internship')).toBe('Business Analyst');
    expect(stripRung('Marketing Intern')).toBe('Marketing');
  });

  it('never mistakes internal-* for a rung', () => {
    expect(stripRung('Internal Communications')).toBe('Internal Communications');
    expect(stripRung('Internal Auditor')).toBe('Internal Auditor');
  });

  it('keeps the rung rather than destroying a two-letter craft', () => {
    expect(stripRung('IT Intern')).toBe('IT Intern');
  });

  it('leaves everything else exactly as typed', () => {
    expect(stripRung('Data Analyst')).toBe('Data Analyst');
    expect(stripRung('Contract Administrator')).toBe('Contract Administrator');
    expect(stripRung('Intern')).toBe('Intern');
    expect(stripRung('')).toBe('');
  });
});
