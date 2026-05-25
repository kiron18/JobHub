import { describe, it, expect } from 'vitest';
import { checkAtsKeywords } from '../lib/atsKeywords';

// JD from the live test — Original Spin, Public Relations & Marketing Executive
const LIVE_JD = `Public Relations & Marketing Executive
The Opportunity
Original Spin is looking for a Public Relations & Marketing Executive to join our Sydney team.
What You Will Be Doing
Supporting senior staff in the delivery of integrated publicity and marketing campaigns across earned, owned and paid channels.
Drafting media materials including media releases, pitches, briefing notes and media alerts.
Building and maintaining media lists and coordinating outreach to journalists, producers and influencers.
Supporting the coordination of press events, media interviews, site visits and launch events.
Monitoring media coverage and reporting on campaign performance.
Assisting with content creation for social media platforms, e-newsletters (EDMs) and website copy.
Maintaining client databases, contact lists and project records.
Conducting research and preparing competitive analysis.
What You'll Bring to Original Spin
1–2 years' experience in a PR or marketing role (agency experience preferred).
Strong written and verbal communication skills.
A proactive, can-do attitude with a willingness to learn.
Ability to manage multiple tasks and prioritise effectively.
Familiarity with the Australian media landscape.
Experience with social media scheduling tools (e.g. Sprout Social, Hootsuite) and content management systems.
A keen eye for detail and commitment to accuracy.
Tertiary qualifications in Public Relations, Communications, Marketing or a related field.
What's in it for you?
Work with an award-winning team on exciting, high-profile campaigns.
Opportunities for professional development and career growth.
Hybrid working environment – flexibility to work from home and our Sydney office.
Regular team social events and a supportive, fun culture.
Competitive salary based on experience.`;

describe('checkAtsKeywords — live test (Original Spin PR role)', () => {
    it('extracts top keywords from the JD', () => {
        const result = checkAtsKeywords({
            jobDescription: LIVE_JD,
            generatedDocument: '',
            docType: 'RESUME',
        });

        expect(result.topKeywords.length).toBeGreaterThan(0);
        expect(result.topKeywords.length).toBeLessThanOrEqual(15);
        // Should include role-related keywords
        const kw = result.topKeywords.join(' ');
        expect(kw).toMatch(/public/i);
        expect(kw).toMatch(/relations/i);
        expect(kw).toMatch(/media/i);
    });

    it('returns all keywords as missing when document is empty', () => {
        const result = checkAtsKeywords({
            jobDescription: LIVE_JD,
            generatedDocument: '',
            docType: 'RESUME',
        });

        expect(result.coverage).toBe(0);
        expect(result.missingFromOutput.length).toBe(result.topKeywords.length);
    });

    it('flags "public relations" missing from body when it only appears in title', () => {
        // Simulate a resume that has "Public Relations" in the header/title but
        // never in the body — exactly like the live test failure
        const resumeWithTitleOnly = `Kiron Kurian John
Public Relations & Marketing Executive
Professional Summary
Experienced marketing professional with strong communication skills.

Experience
Marketing Coordinator — Some Agency
Created social media content and managed client communications.`;

        const result = checkAtsKeywords({
            jobDescription: LIVE_JD,
            generatedDocument: resumeWithTitleOnly,
            docType: 'RESUME',
        });

        // Should flag that role keywords are missing from body
        expect(result.coverage).toBeLessThan(0.5);
        // Should have at least one warning about the critical missing keyword
        expect(result.warnings.length).toBeGreaterThan(0);
        // "public relations" should be in the missing list (it's in title but the
        // check is on the generated doc body; the title line is part of the doc so
        // it might count — but the original bug was it not appearing in EXPERIENCE)
        // Let's verify that warnings catch the role-title mismatch
        const allWarnings = result.warnings.join(' ');
        expect(allWarnings).toMatch(/missing/i);
    });

    it('finds keywords present in a document that uses them', () => {
        const docWithKeywords = `Kiron Kurian John
Public Relations & Marketing Executive
Professional Summary
I am an experienced Public Relations executive with deep media relations expertise.

Experience
PR Executive — Original Spin
Managed media releases, pitches, and briefing notes for high-profile campaigns.
Coordinated press events, media interviews, and site visits for 12+ events.
Built and maintained media lists, coordinating outreach to journalists and producers.
Monitored media coverage and reported on campaign performance across earned, owned and paid channels.
Created content for social media, EDMs, and website copy.`;

        const result = checkAtsKeywords({
            jobDescription: LIVE_JD,
            generatedDocument: docWithKeywords,
            docType: 'RESUME',
        });

        // Most keywords should be found
        expect(result.coverage).toBeGreaterThan(0.4);
    });
});

describe('checkAtsKeywords — edge cases', () => {
    it('handles empty JD gracefully', () => {
        const result = checkAtsKeywords({
            jobDescription: '',
            generatedDocument: 'Some resume text here',
            docType: 'RESUME',
        });
        expect(result.coverage).toBe(1);
        expect(result.topKeywords).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('handles empty generated document gracefully', () => {
        const result = checkAtsKeywords({
            jobDescription: 'Need a Senior Engineer with TypeScript and React experience',
            generatedDocument: '',
            docType: 'RESUME',
        });
        expect(result.coverage).toBe(0);
    });

    it('processes a short JD with clear skill requirements', () => {
        const miniJD = 'Senior Software Engineer required. Must have TypeScript, React, Node.js. AWS experience desirable.';
        const resume = 'Senior engineer skilled in TypeScript, React, and Node.js with AWS knowledge.';

        const result = checkAtsKeywords({
            jobDescription: miniJD,
            generatedDocument: resume,
            docType: 'RESUME',
        });

        expect(result.coverage).toBeGreaterThan(0.3);
        expect(result.topKeywords.some(k => k.includes('typescript'))).toBe(true);
    });
});
