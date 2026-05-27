import { describe, it, expect } from 'vitest';
import { profileToMarkdown } from '@shared/lib/profileToMarkdown';
import { profileToResumeData, type ProfileWithRelations } from '@shared/lib/profileToResumeData';

// ---------- helpers ----------

const makeProfile = (overrides?: Partial<ProfileWithRelations>): ProfileWithRelations => ({
  name: 'Alice Testing',
  experience: [],
  education: [],
  ...overrides,
});

/**
 * Split markdown into non-empty lines for assertion checks.
 */
const mdLines = (md: string): string[] => md.split('\n').filter(l => l.trim() !== '');

// ---------- suite ----------

describe('profileToResumeData → profileToMarkdown formatting invariants', () => {

  // 1. No glued headings
  it('no glued headings (## immediately followed by non-space)', () => {
    const profile = makeProfile({
      professionalSummary: 'A summary.',
      experience: [{
        id: 'exp-1',
        role: 'Developer',
        company: 'ACME',
        startDate: '2020-01',
        endDate: '2023-06',
        description: 'Did stuff',
      }],
    });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    // Find all lines that start with "## " (level-2 headings).
    // Level-3 headings "### " are fine — we only care about not gluing "##".
    const lines = md.split('\n');
    const h2Lines = lines.filter(l => /^## .+/.test(l));
    // At minimum we have Professional Summary, Work Experience, Referees
    expect(h2Lines.length).toBeGreaterThanOrEqual(3);
    // Verify none of them have "##" immediately followed by a non-space
    for (const line of h2Lines) {
      expect(line).toMatch(/^## /);
    }
    // Also verify the full output has no occurrences of "##" followed
    // by a word character (no broken markdown)
    expect(md).not.toMatch(/##\w/);
    expect(md).not.toMatch(/##[a-z]/i);
  });

  // 2. Blank lines above and below every "## " heading
  it('blank lines above and below every ## heading', () => {
    const profile = makeProfile({
      professionalSummary: 'A summary.',
      skills: 'Technical: A • B',
    });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    const lines = md.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (/^## /.test(lines[i])) {
        // Line above should be empty (or we're at the top of the doc)
        if (i > 0) {
          expect(lines[i - 1].trim()).toBe('');
        }
        // Line below should be empty (or we're at the end)
        if (i < lines.length - 1) {
          expect(lines[i + 1].trim()).toBe('');
        }
      }
    }
  });

  // 3. Each bullet line starts with "- "
  it('each bullet line starts with "- "', () => {
    const profile = makeProfile({
      experience: [{
        id: 'exp-1',
        role: 'Engineer',
        company: 'Inc',
        startDate: '2020-01',
        description: 'Led team\nBuilt system\nShipped feature',
      }],
    });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    // Collect lines that are inside experience sections (after "###")
    // Instead, just find all lines starting with "- "
    const bulletLines = md.split('\n').filter(l => l.startsWith('- '));
    expect(bulletLines.length).toBeGreaterThan(0);
    // Every bullet line with "- " inside the markdown should be valid
    expect(bulletLines).toEqual([
      '- Led team',
      '- Built system',
      '- Shipped feature',
    ]);
  });

  // 4. Candidate name appears as H1
  it('candidate name appears as H1', () => {
    const profile = makeProfile();
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    expect(md).toMatch(/^# Alice Testing$/m);
  });

  // 5. Sections with no data are omitted
  it('sections with no data are omitted', () => {
    const profile = makeProfile({
      professionalSummary: undefined,
      skills: undefined,
    });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    // These section headings should NOT appear
    expect(md).not.toContain('Professional Summary');
    expect(md).not.toContain('Skills & Competencies');
    expect(md).not.toContain('Work Experience');
    // Referees section appears by default
    expect(md).toContain('Referees');
  });

  // 6. Referees section shows by default
  it('Referees section shows by default', () => {
    const profile = makeProfile();
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    expect(md).toContain('## Referees');
    expect(md).toContain('Available upon request');
  });

  // 7. Referees section hidden when showReferees: false
  it('Referees section hidden when showReferees: false', () => {
    const profile = makeProfile({ showReferees: false });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    expect(md).not.toContain('Referees');
  });

  // 8. Date ranges render correctly
  it('date ranges render correctly', () => {
    const profile = makeProfile({
      experience: [{
        id: 'exp-1',
        role: 'Developer',
        company: 'ACME',
        startDate: 'Jan 2020',
        endDate: 'Jun 2023',
        description: 'Worked',
      }, {
        id: 'exp-2',
        role: 'Senior Dev',
        company: 'Beta',
        startDate: 'Jul 2023',
        endDate: null,
        isCurrent: true,
        description: 'Still working',
      }],
    });
    const data = profileToResumeData(profile);
    const md = profileToMarkdown(data);
    // Check date ranges appear in italics on the meta line
    expect(md).toContain('Jan 2020 — Jun 2023');
    expect(md).toContain('Jul 2023 — Present');
  });

  // -- Additional tests for profileToResumeData directly --

  it('maps all fields correctly from profile to ResumeData', () => {
    const profile: ProfileWithRelations = {
      name: 'Bob Smith',
      email: 'bob@test.com',
      phone: '0400 000 000',
      linkedin: 'linkedin.com/in/bob',
      location: 'Sydney',
      targetRole: 'Senior Engineer',
      professionalSummary: 'A summary.',
      skills: 'Technical: X\nSoft: Y',
      showReferees: true,
      experience: [{
        id: 'exp-1',
        role: 'Engineer',
        company: 'Co',
        location: 'Melbourne',
        startDate: '2021',
        endDate: null,
        isCurrent: true,
        description: 'Did things',
      }],
      education: [{
        degree: 'BSc',
        field: 'CS',
        institution: 'Uni',
        location: 'Sydney',
        year: '2020',
        startDate: '2016',
        endDate: '2020',
      }],
      certifications: [{ name: 'AWS', issuingBody: 'Amazon', year: '2023' }],
      volunteering: [{ role: 'Mentor', organization: 'Org', description: 'Mentored' }],
      languages: [{ name: 'English', proficiency: 'Native' }],
    };

    const data = profileToResumeData(profile);

    expect(data.name).toBe('Bob Smith');
    expect(data.email).toBe('bob@test.com');
    expect(data.phone).toBe('0400 000 000');
    expect(data.linkedin).toBe('linkedin.com/in/bob');
    expect(data.location).toBe('Sydney');
    expect(data.targetRole).toBe('Senior Engineer');
    expect(data.professionalSummary).toBe('A summary.');
    expect(data.skills).toBe('Technical: X\nSoft: Y');
    expect(data.showReferees).toBe(true);

    expect(data.experience).toHaveLength(1);
    expect(data.experience[0]).toEqual({
      role: 'Engineer',
      company: 'Co',
      location: 'Melbourne',
      startDate: '2021',
      endDate: null,
      isCurrent: true,
      description: 'Did things',
    });
    // id must NOT be in the output (ResumeData doesn't have it)
    expect((data.experience[0] as any).id).toBeUndefined();

    expect(data.education).toHaveLength(1);
    expect(data.education[0]).toEqual({
      degree: 'BSc',
      field: 'CS',
      institution: 'Uni',
      location: 'Sydney',
      year: '2020',
      startDate: '2016',
      endDate: '2020',
    });

    expect(data.certifications).toHaveLength(1);
    expect(data.certifications![0]).toEqual({ name: 'AWS', issuingBody: 'Amazon', year: '2023' });

    expect(data.volunteering).toHaveLength(1);
    expect(data.volunteering![0]).toEqual({ role: 'Mentor', organization: 'Org', description: 'Mentored' });

    expect(data.languages).toHaveLength(1);
    expect(data.languages![0]).toEqual({ name: 'English', proficiency: 'Native' });
  });

  it('handles null/undefined fields gracefully', () => {
    const profile = makeProfile({
      name: undefined,
      professionalSummary: null,
      skills: null,
      showReferees: null,
      experience: [],
      education: [],
      certifications: [],
      volunteering: [],
      languages: [],
    });
    const data = profileToResumeData(profile);
    expect(data.name).toBe('');
    expect(data.professionalSummary).toBeUndefined();
    expect(data.skills).toBeUndefined();
    expect(data.showReferees).toBe(true); // null → default true
    expect(data.experience).toEqual([]);
    expect(data.education).toEqual([]);
    expect(data.certifications).toEqual([]);
    expect(data.volunteering).toEqual([]);
    expect(data.languages).toEqual([]);
  });

});
