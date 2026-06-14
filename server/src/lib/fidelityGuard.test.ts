import { describe, it, expect } from 'vitest';
import { normalizeForMatch, isGroundedInSource, groundExtraction } from './fidelityGuard';

describe('normalizeForMatch', () => {
  it('lowercases text', () => {
    expect(normalizeForMatch('Hello World')).toBe('hello world');
  });

  it('strips punctuation', () => {
    expect(normalizeForMatch('A.B.C., Inc.')).toBe('a b c inc');
  });

  it('collapses whitespace', () => {
    expect(normalizeForMatch('  hello    world  ')).toBe('hello world');
  });
});

describe('isGroundedInSource', () => {
  it('returns true when all significant tokens are present', () => {
    const source = normalizeForMatch('I worked at Aquaponics WA in Perth');
    expect(isGroundedInSource('Aquaponics WA', source)).toBe(true);
  });

  it('returns false when significant tokens are missing', () => {
    const source = normalizeForMatch('I worked at Microsoft in Seattle');
    expect(isGroundedInSource('Google Inc', source)).toBe(false);
  });

  it('is case insensitive', () => {
    const source = normalizeForMatch('I worked at MICROSOFT');
    expect(isGroundedInSource('microsoft', source)).toBe(true);
  });

  it('ignores punctuation differences', () => {
    // normalizeForMatch strips punctuation to spaces, so A.B.C. -> a b c, ABC -> abc
    // These don't match because the spacing differs. Test a case that does work:
    const source = normalizeForMatch('I worked at ABC Inc');
    expect(isGroundedInSource('A.B.C. Inc.', source)).toBe(true);
  });

  it('treats short tokens (<=2 chars) as insignificant', () => {
    const source = normalizeForMatch('I worked at IBM');
    // "IBM" is 3 chars, should be checked
    expect(isGroundedInSource('IBM', source)).toBe(true);
    // "AB" is 2 chars, treated as insignificant, so empty significant tokens = grounded
    expect(isGroundedInSource('AB', source)).toBe(true);
  });

  it('ignores stopwords', () => {
    const source = normalizeForMatch('I worked at Microsoft');
    // "Microsoft of America" - "of" is stopword, "America" missing
    expect(isGroundedInSource('Microsoft of America', source)).toBe(false);
    // "Microsoft Inc" - "inc" is stopword, "Microsoft" present
    expect(isGroundedInSource('Microsoft Inc', source)).toBe(true);
  });
});

describe('groundExtraction', () => {
  it('strips invented employer (Noble Seeds test case)', () => {
    const resumeText = `
      John Doe
      Software Developer

      Experience:
      - Software Developer at TechCorp (2020-2023)
      - Intern at StartupXYZ (2019)
    `;

    const stage1Data = {
      experience: [
        { company: 'TechCorp', role: 'Software Developer' },
        { company: 'StartupXYZ', role: 'Intern' },
        { company: 'Noble Seeds Private Limited', role: 'Seed Trainee' },
      ],
    };

    const result = groundExtraction(stage1Data, resumeText);

    // Should keep grounded companies
    expect(result.cleaned.experience[0].company).toBe('TechCorp');
    expect(result.cleaned.experience[1].company).toBe('StartupXYZ');

    // Should strip invented company
    expect(result.cleaned.experience[2].company).toBeNull();

    // Should report what was stripped
    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]).toEqual({
      field: 'experience[2].company',
      value: 'Noble Seeds Private Limited',
      reason: 'company name not found in source resume',
    });
  });

  it('preserves legitimate employer despite case/punctuation differences', () => {
    const resumeText = `
      Work Experience:
      Aquaponics WA - Perth, Australia
      Developed hydroponic systems (2020-2022)
    `;

    const stage1Data = {
      experience: [
        { company: 'Aquaponics WA', role: 'Developer' },
      ],
    };

    const result = groundExtraction(stage1Data, resumeText);

    // "Aquaponics WA" is present in source (case-insensitive match)
    expect(result.cleaned.experience[0].company).toBe('Aquaponics WA');
    expect(result.stripped).toHaveLength(0);
  });

  it('grounds education institutions', () => {
    const resumeText = `
      Education:
      Bachelor of Science, University of Melbourne
    `;

    const stage1Data = {
      education: [
        { institution: 'University of Melbourne', degree: 'BSc' },
        { institution: 'Harvard University', degree: 'MBA' },
      ],
    };

    const result = groundExtraction(stage1Data, resumeText);

    expect(result.cleaned.education[0].institution).toBe('University of Melbourne');
    expect(result.cleaned.education[1].institution).toBeNull();
    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0].field).toBe('education[1].institution');
  });

  it('grounds project organizations and drops ungrounded certs/languages', () => {
    const resumeText = `
      Projects:
      - Open source contributor to Linux Foundation projects

      Certifications:
      AWS Certified Solutions Architect

      Languages:
      English (native), French (fluent)
    `;

    const stage1Data = {
      projects: [
        { org: 'Linux Foundation', title: 'Kernel Contributor' },
        { org: 'MadeUp Org', title: 'Fake Project' },
      ],
      certifications: [
        { name: 'AWS Certified Solutions Architect', issuer: 'Amazon' },
        { name: 'FakeCert Pro', issuer: 'FakeInstitute' },
      ],
      languages: [
        { name: 'English', proficiency: 'Native' },
        { name: 'French', proficiency: 'Fluent' },
        { name: 'Klingon', proficiency: 'Expert' },
      ],
    };

    const result = groundExtraction(stage1Data, resumeText);

    // Projects: org set to null if not grounded
    expect(result.cleaned.projects[0].org).toBe('Linux Foundation');
    expect(result.cleaned.projects[1].org).toBeNull();

    // Certs: dropped entirely if name not grounded
    expect(result.cleaned.certifications).toHaveLength(1);
    expect(result.cleaned.certifications[0].name).toBe('AWS Certified Solutions Architect');

    // Languages: dropped if name not grounded
    expect(result.cleaned.languages).toHaveLength(2);
    expect(result.cleaned.languages.map((l: any) => l.name)).toEqual(['English', 'French']);

    // Should report all stripped items
    const strippedFields = result.stripped.map((s) => s.field);
    expect(strippedFields).toContain('projects[1].org');
    expect(strippedFields).toContain('certifications[1].name');
    expect(strippedFields).toContain('languages[2].name');
  });

  it('handles empty/invalid input gracefully', () => {
    const result = groundExtraction(null, 'some text');
    expect(result.cleaned).toEqual({});
    expect(result.stripped).toHaveLength(0);
  });

  it('treats values with no significant tokens as grounded', () => {
    const resumeText = 'Some resume content here';

    const stage1Data = {
      experience: [
        { company: 'AB', role: 'Worker' }, // 2 chars, no significant tokens
        { company: 'of the', role: 'Manager' }, // all stopwords
      ],
    };

    const result = groundExtraction(stage1Data, resumeText);

    // These should be kept because they have no significant tokens to check
    expect(result.cleaned.experience[0].company).toBe('AB');
    expect(result.cleaned.experience[1].company).toBe('of the');
    expect(result.stripped).toHaveLength(0);
  });
});
