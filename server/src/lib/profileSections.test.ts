import { describe, it, expect } from 'vitest';
import {
  buildProfileSections,
  spliceProfileSections,
  SUPPLIED_MARKER,
} from './profileSections';
import { groundSkillsSection } from './groundSkills';

const edu = (over: any = {}) => ({
  degree: 'Master of Data Science',
  field: null,
  institution: 'Monash University',
  location: 'Melbourne',
  year: '2025',
  startDate: null,
  endDate: null,
  ...over,
});

/**
 * An uploaded resume as the extractor sees one: shouted headings, plain text.
 * The guards read this, so the fixtures have to look like the real thing.
 */
const resumeWith = (educationLines: string[], extra = '') =>
  [
    'JANE DOE',
    '',
    'PROFILE',
    'Currently pursuing a Master of Data Science at Monash University, Melbourne.',
    '',
    'EDUCATION',
    ...educationLines,
    '',
    extra,
    'SKILLS',
    'SQL',
  ].join('\n');

const ONE_DEGREE = resumeWith(['Master of Data Science, Monash University, Melbourne, 2025']);
const TWO_DEGREES = resumeWith([
  'Master of Data Science, Monash University, Melbourne, 2025',
  'Bachelor of Computer Engineering, Thapar Institute, 2022',
]);

describe('buildProfileSections decides what it is safe to render', () => {
  it('renders education when every entry is complete', () => {
    const s = buildProfileSections({ education: [edu()], resumeRawText: ONE_DEGREE });
    expect(s.find((x) => x.key === 'education')?.body)
      .toBe('**Master of Data Science**  ·  2025\nMonash University, Melbourne');
  });

  it('refuses the whole section when ONE entry has no date', () => {
    const s = buildProfileSections({
      education: [edu(), edu({ degree: 'Bachelor of Computer Engineering', institution: 'Thapar Institute', year: null })],
      resumeRawText: TWO_DEGREES,
    });
    // Dates on one degree and not the other is worse than what the model wrote,
    // so the model keeps the job.
    expect(s.find((x) => x.key === 'education')).toBeUndefined();
  });

  it('refuses when the institution is missing', () => {
    const s = buildProfileSections({ education: [edu({ institution: '' })], resumeRawText: ONE_DEGREE });
    expect(s.find((x) => x.key === 'education')).toBeUndefined();
  });

  it('falls back to start/end dates when there is no year', () => {
    const s = buildProfileSections({
      education: [edu({ year: null, startDate: 'Jun 2018', endDate: 'Jul 2022' })],
      resumeRawText: ONE_DEGREE,
    });
    expect(s.find((x) => x.key === 'education')?.body).toContain('·  Jun 2018 - Jul 2022');
  });

  it('adds the field only when the degree does not already name it', () => {
    const r = resumeWith(['Bachelor of Science, Monash University, Melbourne, 2025']);
    const a = buildProfileSections({
      education: [edu({ degree: 'Bachelor of Science', field: 'Chemistry' })],
      resumeRawText: r,
    });
    expect(a[0].body).toContain('**Bachelor of Science (Chemistry)**');

    const b = buildProfileSections({
      education: [edu({ field: 'Data Science' })],
      resumeRawText: ONE_DEGREE,
    });
    expect(b[0].body).toContain('**Master of Data Science**  ·');
  });

  // ── The guard that stops a qualification vanishing ────────────────────────

  it('refuses to splice when the resume lists more degrees than we hold', () => {
    // Extraction missed a degree. Splicing would quietly remove it.
    const s = buildProfileSections({
      education: [edu({ degree: 'Bachelor of Computer Engineering', institution: 'Thapar Institute', year: '2022' })],
      resumeRawText: TWO_DEGREES,
    });
    expect(s.find((x) => x.key === 'education')).toBeUndefined();
  });

  it('splices when the stored entries account for all of them', () => {
    const s = buildProfileSections({
      education: [
        edu({ location: null }),
        edu({ degree: 'Bachelor of Computer Engineering', institution: 'Thapar Institute', location: null, year: '2022' }),
      ],
      resumeRawText: TWO_DEGREES,
    });
    expect(s.find((x) => x.key === 'education')?.body).toBe(
      '**Master of Data Science**  ·  2025\nMonash University\n\n' +
      '**Bachelor of Computer Engineering**  ·  2022\nThapar Institute',
    );
  });

  it('does not count a summary mention as a second degree', () => {
    // The PROFILE line names the master's too. Counting the whole document
    // would see two degrees for one entry and refuse a correct splice.
    const s = buildProfileSections({ education: [edu()], resumeRawText: ONE_DEGREE });
    expect(s.some((x) => x.key === 'education')).toBe(true);
  });

  it('refuses when it cannot find an education section to check against', () => {
    const s = buildProfileSections({ education: [edu()], resumeRawText: 'Just some prose.' });
    expect(s.find((x) => x.key === 'education')).toBeUndefined();
  });

  it('drops a stored location the resume never mentions', () => {
    // Extraction can infer a campus or city. A spliced fact is held to the same
    // standard as a written one: not in the resume, not on the resume.
    const s = buildProfileSections({
      education: [edu({ location: 'Geelong' })],
      resumeRawText: ONE_DEGREE,
    });
    expect(s[0].body).toBe('**Master of Data Science**  ·  2025\nMonash University');
  });

  // ── Certifications ────────────────────────────────────────────────────────

  it('renders certifications with or without an issuer', () => {
    const resume = resumeWith(
      ['Master of Data Science, Monash University, Melbourne, 2025'],
      'CERTIFICATIONS\nAWS Cloud Practitioner\nCS2\n',
    );
    const s = buildProfileSections({
      certifications: [
        { name: 'AWS Cloud Practitioner', issuingBody: 'Amazon', year: '2024' },
        { name: 'CS2', issuingBody: '', year: null },
      ],
      resumeRawText: resume,
    });
    expect(s.find((x) => x.key === 'certifications')?.body)
      .toBe('- AWS Cloud Practitioner (Amazon, 2024)\n- CS2');
  });

  it('refuses certifications when the resume block lists more than we hold', () => {
    const resume = 'CERTIFICATIONS\nMCSA SQL Server\nDbvisit Associate\nPMP Training\nAWS Practitioner\n';
    const s = buildProfileSections({
      certifications: [{ name: 'MCSA SQL Server', issuingBody: 'Microsoft', year: null }],
      resumeRawText: resume,
    });
    expect(s.find((x) => x.key === 'certifications')).toBeUndefined();
  });

  it('refuses to invent a certifications section the resume never had', () => {
    const s = buildProfileSections({
      certifications: [{ name: 'PMP', issuingBody: 'PMI', year: '2020' }],
      resumeRawText: ONE_DEGREE,
    });
    expect(s.find((x) => x.key === 'certifications')).toBeUndefined();
  });

  // ── Referees ──────────────────────────────────────────────────────────────

  it('writes the referees boilerplate only when the resume names no referees', () => {
    expect(buildProfileSections({ resumeRawText: 'Work history and skills.' })
      .find((s) => s.key === 'referees')?.body).toBe('Available upon request.');

    expect(buildProfileSections({ resumeRawText: 'REFEREES\nDr Jane Smith, Head of School, 0400 000 000' })
      .find((s) => s.key === 'referees')).toBeUndefined();

    expect(buildProfileSections({ resumeRawText: 'References available upon request' })
      .find((s) => s.key === 'referees')?.body).toBe('Available upon request.');
  });
});

const DOC = [
  '# Jane Doe',
  '',
  '## Professional Summary',
  '',
  'I do things.',
  '',
  '## Work Experience',
  '',
  '### Analyst | Acme',
  '- Did a thing.',
  '',
  '## Education',
  '',
  SUPPLIED_MARKER,
  '',
  '## Skills & Competencies',
  '',
  '**Data:** SQL',
  '',
  '## Referees',
  '',
  SUPPLIED_MARKER,
  '',
].join('\n');

describe('spliceProfileSections', () => {
  const sections = buildProfileSections({ education: [edu()], resumeRawText: ONE_DEGREE });

  it('fills the body and leaves the heading where the model put it', () => {
    const r = spliceProfileSections(DOC, sections);
    expect(r.content).not.toContain(SUPPLIED_MARKER);
    expect(r.content).toContain('**Master of Data Science**  ·  2025');
    expect(r.applied.sort()).toEqual(['education', 'referees']);
    expect(r.appended).toEqual([]);
    // Order is the candidate's: Education still sits before Skills.
    expect(r.content.indexOf('## Education')).toBeLessThan(r.content.indexOf('## Skills'));
  });

  const certSections = buildProfileSections({
    certifications: [{ name: 'PMP', issuingBody: 'PMI', year: '2020' }],
    resumeRawText: 'CERTIFICATIONS\nPMP\n',
  }).filter((s) => s.key === 'certifications');

  it('matches a section the model named differently', () => {
    const doc = `# X\n\n## Courses & Certifications\n\n${SUPPLIED_MARKER}\n`;
    const r = spliceProfileSections(doc, certSections);
    expect(r.content).toContain('## Courses & Certifications');
    expect(r.content).toContain('- PMP (PMI, 2020)');
  });

  it('appends a section whose heading the model never wrote', () => {
    const doc = '# X\n\n## Professional Summary\n\nHi.\n';
    const r = spliceProfileSections(doc, sections.filter((s) => s.key === 'education'));
    expect(r.appended).toEqual(['education']);
    expect(r.content).toContain('## Education');
    expect(r.content).toContain('Monash University');
  });

  it('never lets a placeholder reach the candidate', () => {
    const doc = `# X\n\n## Publications\n\n${SUPPLIED_MARKER}\n\n## Skills\n\n**A:** b\n`;
    expect(spliceProfileSections(doc, []).content).not.toContain(SUPPLIED_MARKER);
  });

  it('drops a heading left empty by an unusable placeholder', () => {
    const doc = `# X\n\n## Professional Summary\n\nHi.\n\n## Awards\n\n${SUPPLIED_MARKER}\n`;
    const r = spliceProfileSections(doc, sections.filter((s) => s.key === 'education'));
    expect(r.content).not.toContain(SUPPLIED_MARKER);
    expect(r.content).toContain('Monash University');
  });

  it('is idempotent, and restores a body the emphasis pass altered', () => {
    const once = spliceProfileSections(`# X\n\n## Certifications\n\n${SUPPLIED_MARKER}\n`, certSections);
    expect(once.content).toContain('- PMP (PMI, 2020)');

    // Second pass over already-spliced content changes nothing.
    expect(spliceProfileSections(once.content, certSections).content).toBe(once.content);

    // And an emphasis pass that bolded a certification is undone.
    const bolded = once.content.replace('- PMP (PMI, 2020)', '- **PMP** (PMI, 2020)');
    expect(spliceProfileSections(bolded, certSections).content).toBe(once.content);
  });

  it('is a no-op when there is nothing to supply', () => {
    const doc = '# X\n\n## Education\n\n**BSc**  ·  2020\nUni\n';
    expect(spliceProfileSections(doc, []).content).toBe(doc.trimEnd());
  });
});

describe('groundSkillsSection removes fabricated tools, not described competencies', () => {
  const resume = 'Worked with SQL Server, C# and .NET at Acme. Coordinated with stakeholders on budgets.';
  const doc = (skills: string) => `# X\n\n## Skills & Competencies\n\n**Tech:** ${skills}\n`;

  it('removes a tool the resume does not contain', () => {
    const r = groundSkillsSection(doc('SQL Server, PostgreSQL, C#'), resume);
    expect(r.dropped).toEqual(['PostgreSQL']);
    expect(r.content).toContain('**Tech:** SQL Server, C#');
  });

  it('keeps a described competency the matcher cannot find verbatim', () => {
    expect(groundSkillsSection(doc('stakeholder communication, budget management'), resume).dropped)
      .toEqual([]);
  });

  it('keeps a skill the PDF fused to its heading', () => {
    const r = groundSkillsSection(
      doc('ISO 14001 Standards'),
      'Renewable Energy SystemsISO 14001 Standards and reporting',
    );
    expect(r.dropped).toEqual([]);
  });

  it('removes a qualified claim about an absent tool', () => {
    expect(groundSkillsSection(doc('SQL Server, Python (in progress)'), resume).dropped)
      .toEqual(['Python (in progress)']);
  });

  it('drops a label line left with nothing under it', () => {
    const r = groundSkillsSection(
      `# X\n\n## Skills\n\n**Real:** SQL Server, C#, .NET\n**Invented:** Docker\n`,
      resume,
    );
    expect(r.content).not.toContain('**Invented:**');
    expect(r.content).toContain('**Real:**');
  });

  it('abstains rather than gutting the section', () => {
    const r = groundSkillsSection(doc('Docker, Kubernetes, Terraform, Kafka, Redis'), resume);
    expect(r.abstained).toBe(true);
    expect(r.content).toContain('Docker');
  });

  it('leaves everything outside the Skills section alone', () => {
    const md = `# X\n\n## Work Experience\n\n- Used Docker daily.\n\n## Skills\n\n**Tech:** C#\n`;
    expect(groundSkillsSection(md, resume).content).toContain('- Used Docker daily.');
  });
});
