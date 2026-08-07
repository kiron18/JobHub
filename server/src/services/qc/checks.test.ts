import { describe, it, expect } from 'vitest';
import {
    runDeterministicChecks, scoreFindings, extractClaimedFigures,
    isPlausibleCompanyName, extractNamedOrganisations, type QcInput,
} from './checks';

const SOURCE_RESUME = `
Nurse with experience at Ramsay Health Care and Epworth HealthCare.
Reduced patient wait times by 35% across a 120 bed ward.
Managed a budget of $12,000 for ward supplies.
Registered Nurse, Ramsay Health Care, 2021 to 2024.
Graduate Nurse, Epworth HealthCare, 2020 to 2021.
Completed a Bachelor of Nursing at Monash University.
`.repeat(2);

const JD = `
Registered Nurse - Surgical Ward
St Vincent's Hospital is seeking a Registered Nurse for our surgical ward.
You will provide post-operative patient care, manage medication administration,
work within a multidisciplinary team and maintain accurate clinical documentation.
Requirements: AHPRA registration, acute care experience, strong communication,
experience with electronic medical records and infection control protocols.
We offer ongoing professional development and a supportive nursing team.
`.repeat(3);

function input(over: Partial<QcInput> = {}): QcInput {
    return {
        docType: 'COVER_LETTER',
        content: 'placeholder',
        jobDescription: JD,
        jobTitle: 'Registered Nurse',
        company: "St Vincent's Hospital",
        profile: {
            name: 'Priya Sharma',
            resumeRawText: SOURCE_RESUME,
            yearsOfExperience: 4,
            experience: [
                { company: 'Ramsay Health Care', role: 'Registered Nurse' },
                { company: 'Epworth HealthCare', role: 'Graduate Nurse' },
            ],
            achievements: [{ description: 'Reduced patient wait times by 35%', metric: '35%' }],
        },
        ...over,
    };
}

const has = (r: ReturnType<typeof runDeterministicChecks>, check: string) =>
    r.findings.some(f => f.check === check);

describe('targeting', () => {
    it('flags a cover letter that never names the employer', () => {
        const r = runDeterministicChecks(input({
            content: 'I am a registered nurse with surgical ward experience. '.repeat(30),
        }));
        expect(has(r, 'targeting.company_not_named')).toBe(true);
    });

    it('does not flag a letter that does name the employer', () => {
        const r = runDeterministicChecks(input({
            content: `I would like to join St Vincent's Hospital as a registered nurse. `.repeat(30),
        }));
        expect(has(r, 'targeting.company_not_named')).toBe(false);
    });

    it('catches a document still naming a different employer the client applied to', () => {
        // The copy-paste catastrophe. Nothing else in the system can see this.
        const r = runDeterministicChecks(input({
            content: `I am excited to join Epworth HealthCare and support St Vincent's Hospital patients. `.repeat(20),
            otherCompanies: ['Epworth HealthCare', 'Alfred Health'],
        }));
        const finding = r.findings.find(f => f.check === 'targeting.wrong_employer_named');
        expect(finding).toBeDefined();
        expect(finding?.evidence).toContain('Epworth HealthCare');
    });

    it('does not fire on a company name buried inside a longer word', () => {
        // Found on real data: "Tanda" matched inside "standard" and flagged
        // half the archive. Whole-word matching is what stops that.
        const r = runDeterministicChecks(input({
            content: `I maintain a high standard of care at St Vincent's Hospital. `.repeat(25),
            otherCompanies: ['Tanda'],
        }));
        expect(has(r, 'targeting.wrong_employer_named')).toBe(false);
    });

    it('ignores the extraction fragments that fill the company column on real data', () => {
        // Real values from the production table. Comparing against these
        // flagged almost every document.
        const r = runDeterministicChecks(input({
            content: `I manage risk and pace my work at St Vincent's Hospital, scaling data to its core. `.repeat(20),
            otherCompanies: ['risk', 'pace', 'its core', 'raw data', 'Unknown', 'the door'],
        }));
        expect(has(r, 'targeting.wrong_employer_named')).toBe(false);
    });

    it('does not treat the employer being applied to as a wrong employer', () => {
        const r = runDeterministicChecks(input({
            content: `St Vincent's Hospital is where I want to nurse. `.repeat(30),
            otherCompanies: ["St Vincent's Hospital"],
        }));
        expect(has(r, 'targeting.wrong_employer_named')).toBe(false);
    });

    it('reports missing targeting as unassessable rather than passing it', () => {
        // A one-line stand-in is not an advert. Scoring it as well-targeted
        // would be the QC pass inventing a verdict.
        const r = runDeterministicChecks(input({
            content: 'Some content. '.repeat(100),
            jobDescription: 'Registered Nurse at St Vincent Hospital',
        }));
        expect(r.metrics.atsCoverage).toBeNull();
        expect(r.unassessable.join(' ')).toMatch(/job description/i);
        expect(has(r, 'targeting.ats_coverage')).toBe(false);
    });
});

describe('honesty', () => {
    it('flags figures that trace back to nothing the client gave us', () => {
        const r = runDeterministicChecks(input({
            content: `I lifted throughput by 87% and saved $450,000 across 300 beds. `.repeat(20),
        }));
        const f = r.findings.find(x => x.check === 'honesty.unsourced_figures');
        expect(f).toBeDefined();
        expect(f!.evidence).toEqual(expect.arrayContaining(['87%']));
    });

    it('accepts a figure that is in the source, however it is formatted', () => {
        const r = runDeterministicChecks(input({
            content: `I reduced wait times by 35% and handled a $12,000 budget. `.repeat(20),
        }));
        expect(has(r, 'honesty.unsourced_figures')).toBe(false);
    });

    it('flags a years-of-experience claim that contradicts the file', () => {
        const r = runDeterministicChecks(input({
            content: `With 9 years of nursing experience I am ready for this ward. `.repeat(20),
        }));
        const f = r.findings.find(x => x.check === 'honesty.years_claim');
        expect(f?.severity).toBe('critical');
    });

    it('does not mistake section headings and salutations for invented employers', () => {
        // Found on real data: "Professional Summary", "Dear Hiring Manager",
        // "Work Experience" and "Referees Available" were all reported as
        // organisations the client had invented.
        const r = runDeterministicChecks(input({
            docType: 'RESUME',
            content: [
                'Dear Hiring Manager',
                'Professional Summary',
                'I am a Registered Nurse applying to St Vincent\'s Hospital.',
                'Work Experience',
                'Registered Nurse at Ramsay Health Care',
                'Referees Available on request',
            ].join('\n').repeat(12),
        }));
        expect(has(r, 'honesty.ungrounded_employer')).toBe(false);
    });

    it('still catches an employer the client never worked for', () => {
        const r = runDeterministicChecks(input({
            content: `I spent three seasons at Wentworth Diagnostics before this. `.repeat(20),
        }));
        const f = r.findings.find(x => x.check === 'honesty.ungrounded_employer');
        expect(f?.evidence).toContain('Wentworth Diagnostics');
    });

    it('says so when there is no source resume to check against', () => {
        const r = runDeterministicChecks(input({
            content: 'Anything at all. '.repeat(100),
            profile: { name: 'Priya Sharma', yearsOfExperience: 4 },
        }));
        expect(r.unassessable.join(' ')).toMatch(/no stored resume/i);
        expect(has(r, 'honesty.unsourced_figures')).toBe(false);
    });
});

describe('quality', () => {
    it('flags placeholders that would reach an employer', () => {
        const r = runDeterministicChecks(input({
            content: `Dear [Hiring Manager], I want to join Your Company. `.repeat(30),
        }));
        const f = r.findings.find(x => x.check === 'quality.placeholder_left_in');
        expect(f?.severity).toBe('critical');
    });

    it('flags stock cover-letter openers', () => {
        const r = runDeterministicChecks(input({
            content: `I am writing to express my interest in the role at St Vincent's Hospital. `.repeat(30),
        }));
        expect(has(r, 'quality.generic_opener')).toBe(true);
    });

    it('flags a thin document', () => {
        const r = runDeterministicChecks(input({ content: "Hi, I want the job at St Vincent's Hospital." }));
        expect(has(r, 'quality.too_short')).toBe(true);
    });

    it('flags the same word opening bullet after bullet', () => {
        const r = runDeterministicChecks(input({
            docType: 'RESUME',
            content: [
                "Registered Nurse targeting St Vincent's Hospital surgical ward.",
                '- Managed patient care rounds',
                '- Managed medication administration',
                '- Managed clinical documentation',
                '- Delivered post-operative support',
                '- Supported the multidisciplinary team',
            ].join('\n'),
        }));
        expect(has(r, 'quality.repeated_bullet_openers')).toBe(true);
    });

    it('replays what generation recorded at the time', () => {
        const r = runDeterministicChecks(input({
            content: `A clean letter for St Vincent's Hospital. `.repeat(40),
            generationSignals: [
                { severity: 'warning', category: 'quality_gate', message: 'Quality review flagged issues.' },
            ],
        }));
        expect(has(r, 'generation.quality_gate')).toBe(true);
    });
});

describe('scoring', () => {
    it('weights a fabrication above a style nit', () => {
        const honesty = scoreFindings([
            { check: 'a', dimension: 'honesty', severity: 'critical', message: '' },
        ]);
        const style = scoreFindings([
            { check: 'b', dimension: 'quality', severity: 'critical', message: '' },
        ]);
        expect(honesty.score).toBeLessThan(style.score);
    });

    it('scores a document with nothing found as clean and full marks', () => {
        expect(scoreFindings([])).toEqual({ score: 100, level: 'clean' });
    });

    it('never goes below zero however much is wrong', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({
            check: `c${i}`, dimension: 'honesty' as const, severity: 'critical' as const, message: '',
        }));
        expect(scoreFindings(many).score).toBe(0);
    });
});

describe('isPlausibleCompanyName', () => {
    it('accepts real employers', () => {
        for (const c of ['Ramsay Health Care', 'Atlassian', 'Randstad', 'EARTH AI', 'Medibank']) {
            expect(isPlausibleCompanyName(c)).toBe(true);
        }
    });

    it('rejects the fragments extraction leaves in the company column', () => {
        for (const c of ['risk', 'pace', 'scale', 'its core', 'raw data', 'the door', 'midday', 'Unknown', 'CVT']) {
            expect(isPlausibleCompanyName(c)).toBe(false);
        }
    });
});

describe('extractNamedOrganisations', () => {
    it('picks up employers named the way prose names them', () => {
        const found = extractNamedOrganisations(
            'Registered Nurse at Ramsay Health Care. Studied at Monash University. Consulted for Deloitte Australia.',
        );
        expect(found).toEqual(expect.arrayContaining(['Ramsay Health Care', 'Monash University']));
    });

    it('ignores document furniture', () => {
        const found = extractNamedOrganisations(
            'Dear Hiring Manager\nProfessional Summary\nWork Experience\nReferees Available\nBusiness Intelligence Analyst',
        );
        expect(found).toEqual([]);
    });
});

describe('extractClaimedFigures', () => {
    it('picks up percentages, money and large counts', () => {
        const figures = extractClaimedFigures('Grew it 35%, saved $12,000 across 120 sites.');
        expect(figures).toEqual(expect.arrayContaining(['35%', '$12,000', '120']));
    });

    it('ignores single digits, which are untraceable and would cry wolf', () => {
        expect(extractClaimedFigures('Led 3 teams of 8 nurses')).toEqual([]);
    });
});
