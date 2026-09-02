/**
 * Two things here are worth more than the rest.
 *
 * The LinkedIn note has a hard 200-character ceiling that LinkedIn enforces by
 * silently refusing to send, so an over-budget note is invisible in the UI and
 * only shows up as a connection request that never arrived. The old template
 * measured 199 characters once populated, which left exactly one character for
 * the line it asked the candidate to write.
 *
 * And a greeting is addressed to a real person at a real company. Reading a
 * department or a job title out of an ad as though it were a name is the one
 * failure mode that actively embarrasses the candidate.
 */
import { describe, it, expect } from 'vitest';
import {
    LINKEDIN_NOTE_LIMIT,
    buildOutreachMessages,
    contactNameFromJobDescription,
    contactNameFromSalutation,
    evidenceParagraph,
    shortPitchLine,
    formatPersonName,
    condenseToClause,
    splitCoverLetter,
} from '../outreachFill';

const COVER_LETTER = `Dear Ms Williams,

Meridian's move to consolidate three regional depots onto one planning system is the kind of problem I spent last year on, and it is why the Business Analyst role stood out.

At Vodafone I found invoice processing was taking nine days against a four day target. I rebuilt the approval workflow around exception handling rather than sequential sign off, and cut it to three days across three teams.

Your ad puts stakeholder facilitation ahead of tooling, which matches how that project actually ran.

I'd welcome the chance to discuss this further.

Yours sincerely,

Priya Nair`;

describe('splitCoverLetter', () => {
    it('takes the body and drops the salutation and signoff', () => {
        const { salutation, body } = splitCoverLetter(COVER_LETTER);
        expect(salutation).toBe('Dear Ms Williams,');
        expect(body).toHaveLength(4);
        expect(body.join(' ')).not.toContain('Yours sincerely');
        expect(body.join(' ')).not.toContain('Priya Nair');
    });

    it('reads a letter that opens straight on the salutation with no letterhead', () => {
        const { salutation, body } = splitCoverLetter('Dear Hiring Manager,\n\nOne.\n\nTwo.');
        expect(salutation).toBe('Dear Hiring Manager,');
        expect(body).toEqual(['One.', 'Two.']);
    });

    it('treats a letter with no salutation as all body rather than losing it', () => {
        expect(splitCoverLetter('One.\n\nTwo.').body).toEqual(['One.', 'Two.']);
    });

    it('does not fall over on an empty document', () => {
        expect(splitCoverLetter('')).toEqual({ salutation: '', body: [] });
    });
});

describe('evidenceParagraph', () => {
    it('takes the second paragraph, which is where the quantified story lives', () => {
        const { body } = splitCoverLetter(COVER_LETTER);
        const evidence = evidenceParagraph(body)!;
        expect(evidence).toContain('nine days');
        expect(evidence).toContain('cut it to three days');
    });

    it('falls back to the only paragraph there is', () => {
        expect(evidenceParagraph(['Just the one.'])).toBe('Just the one.');
    });

    it('strips markdown and any placeholder the generator left behind', () => {
        const out = evidenceParagraph(['Opening.', 'I cut it by **40%** [MISSING: team size].'])!;
        expect(out).not.toContain('*');
        expect(out).not.toContain('MISSING');
        expect(out).toContain('40%');
    });

    it('trims a long paragraph at a sentence end, never mid-clause', () => {
        const long = `${'A'.repeat(300)}. ${'B'.repeat(300)}. ${'C'.repeat(300)}.`;
        const out = evidenceParagraph(['Opening.', long])!;
        expect(out.endsWith('.')).toBe(true);
        expect(out).not.toContain('B'.repeat(300));
    });

    it('returns nothing when there is no letter to read', () => {
        expect(evidenceParagraph([])).toBeNull();
    });
});

describe('shortPitchLine', () => {
    it('prefers a sentence carrying a figure, since that is the one doing the work', () => {
        const body = ['This role looks like a strong fit for my background here.', 'I cut invoice processing by 40% in one quarter.'];
        expect(shortPitchLine(body, 120)).toBe('I cut invoice processing by 40% in one quarter.');
    });

    it('takes the longest sentence that fits when the letter quantified nothing', () => {
        const body = ['Short one here for you.', 'This role looks like a strong fit for my background here.'];
        expect(shortPitchLine(body, 120)).toBe('This role looks like a strong fit for my background here.');
    });

    it('never truncates: a sentence that does not fit is not used', () => {
        const line = shortPitchLine(['I cut invoice processing from nine days to three days across three teams.'], 45);
        expect(line).toBeNull();
    });

    it('gives up rather than emit a fragment when the budget is gone', () => {
        expect(shortPitchLine(['I cut it to three days.'], 4)).toBeNull();
    });

    it('will not quote the closing line, which is short but says nothing', () => {
        const { body } = splitCoverLetter(COVER_LETTER);
        expect(shortPitchLine(body, 120)).not.toContain('welcome the chance');
    });
});

describe('contactNameFromSalutation', () => {
    it('reads a first name the ad supplied', () => {
        expect(contactNameFromSalutation('Dear Sarah Chen,')).toBe('Sarah');
    });

    it('keeps the title on a bare surname, because "Hi Williams," is worse than both options', () => {
        expect(contactNameFromSalutation('Dear Ms Williams,')).toBe('Ms Williams');
    });

    it('does not treat the generic salutation as a person', () => {
        expect(contactNameFromSalutation('Dear Hiring Manager,')).toBeNull();
        expect(contactNameFromSalutation('Dear Sir or Madam,')).toBeNull();
        expect(contactNameFromSalutation('')).toBeNull();
    });
});

describe('contactNameFromJobDescription', () => {
    it('picks up the usual Australian phrasings', () => {
        expect(contactNameFromJobDescription('For a confidential discussion please contact Sarah Chen on 03 9000 0000.')).toBe('Sarah');
        expect(contactNameFromJobDescription('Applications should be directed to Michael Tran.')).toBe('Michael');
        expect(contactNameFromJobDescription('Contact: Anne-Marie OBrien')).toBe('Anne-Marie');
        expect(contactNameFromJobDescription('Any questions to Priya before Friday.')).toBe('Priya');
    });

    it('refuses a department or a job title dressed up as a name', () => {
        expect(contactNameFromJobDescription('Please contact Human Resources.')).toBeNull();
        expect(contactNameFromJobDescription('Contact Centre Manager role, apply now.')).toBeNull();
        expect(contactNameFromJobDescription('Please contact Talent Acquisition.')).toBeNull();
        expect(contactNameFromJobDescription('Contact: Recruitment Team')).toBeNull();
    });

    it('refuses the employer name read back at us', () => {
        expect(contactNameFromJobDescription('Please contact Meridian Logistics.', 'Meridian Logistics')).toBeNull();
    });

    it('stays quiet when the ad names nobody', () => {
        expect(contactNameFromJobDescription('We are hiring a Business Analyst in Melbourne.')).toBeNull();
    });

    /*
     * The patterns compile with the `i` flag so the lead-in matches in any
     * case, which also made the `[A-Z]` in NAME_TOKENS match lowercase. Every
     * one of these ran straight past the capitalisation guard and greeted a
     * real person with a joining word out of the ad.
     */
    it('refuses lowercase words that a lead-in happens to run into', () => {
        expect(contactNameFromJobDescription('You can contact and apply via our portal.')).toBeNull();
        expect(contactNameFromJobDescription('Please contact us for more details.')).toBeNull();
        expect(contactNameFromJobDescription('Questions to your local branch.')).toBeNull();
        expect(contactNameFromJobDescription('Applications should be sent to the address below.')).toBeNull();
        expect(contactNameFromJobDescription('Reach out to any of the team.')).toBeNull();
    });

    it('still reads a capitalised name after the same lead-ins', () => {
        expect(contactNameFromJobDescription('You can contact Alice Nguyen to apply.')).toBe('Alice');
        expect(contactNameFromJobDescription('Reach out to Daniel with questions.')).toBe('Daniel');
    });
});

describe('buildOutreachMessages', () => {
    const base = {
        role: 'Business Analyst',
        company: 'Meridian Logistics',
        coverLetter: COVER_LETTER,
        candidateName: 'Priya Nair',
        dateApplied: '2026-08-14T02:00:00.000Z',
    };

    it('fills the name, the date and the evidence with no blanks left', () => {
        const m = buildOutreachMessages(base);
        expect(m.email).toContain('Hi Ms Williams,');
        expect(m.email).toContain('14 Aug 2026');
        expect(m.email).toContain('Priya Nair');
        expect(m.email).toContain('nine days');
        expect(m.email).not.toContain('[');
        expect(m.emailNeedsPitch).toBe(false);
    });

    it('keeps the populated LinkedIn note inside the 200 character limit', () => {
        const m = buildOutreachMessages(base);
        expect(m.linkedIn.length).toBeLessThanOrEqual(LINKEDIN_NOTE_LIMIT);
    });

    it('drops sentences rather than ship a note LinkedIn will silently refuse to send', () => {
        const m = buildOutreachMessages({
            ...base,
            role: 'Senior Business Systems Analyst, Enterprise Transformation',
            company: 'Commonwealth Scientific and Industrial Research Organisation',
        });
        expect(m.linkedIn.length).toBeLessThanOrEqual(LINKEDIN_NOTE_LIMIT);
        // The role and the employer are the two facts the note exists to carry,
        // so they are the last things to go.
        expect(m.linkedIn).toContain('Enterprise Transformation');
        expect(m.linkedIn).toContain('Commonwealth Scientific');
    });

    it('addresses the role rather than inventing a name', () => {
        const m = buildOutreachMessages({
            ...base,
            coverLetter: COVER_LETTER.replace('Dear Ms Williams,', 'Dear Hiring Manager,'),
            jobDescription: 'Business Analyst wanted. Contact our Talent team.',
        });
        expect(m.contactName).toBeNull();
        // The email is formal, the connection note is a DM.
        expect(m.email).toContain('Dear Hiring Manager,');
        expect(m.linkedIn).toContain('Hi there,');
    });

    it('falls back to the job ad when the letter used the generic salutation', () => {
        const m = buildOutreachMessages({
            ...base,
            coverLetter: COVER_LETTER.replace('Dear Ms Williams,', 'Dear Hiring Manager,'),
            jobDescription: 'For a confidential discussion please contact Sarah Chen.',
        });
        expect(m.contactName).toBe('Sarah');
    });

    it('still produces a usable message when there is no cover letter yet', () => {
        const m = buildOutreachMessages({ role: 'Business Analyst', company: 'Meridian Logistics' });
        expect(m.email).toContain('Dear Hiring Manager,');
        expect(m.emailNeedsPitch).toBe(true);
        expect(m.email).toContain('[Two sentences of your own here');
        expect(m.linkedIn).toContain('[One line on why this role fits you.]');
    });

    it('carries no em dashes', () => {
        const m = buildOutreachMessages(base);
        expect(`${m.linkedIn}${m.subject}${m.email}`).not.toMatch(/[—–]/);
    });
});

describe('formatPersonName', () => {
    it('fixes a name stored in capitals, as resume headers often are', () => {
        expect(formatPersonName('KIRON KURIAN JOHN')).toBe('Kiron Kurian John');
    });

    it('leaves a name alone once it has any lowercase, so McDonald survives', () => {
        expect(formatPersonName('Ronan McDonald')).toBe('Ronan McDonald');
        expect(formatPersonName('Maria de Silva')).toBe('Maria de Silva');
    });

    it('capitalises after hyphens and apostrophes', () => {
        expect(formatPersonName("ANNE-MARIE O'BRIEN")).toBe("Anne-Marie O'Brien");
    });

    it('has nothing to say about a missing name', () => {
        expect(formatPersonName(undefined)).toBeUndefined();
        expect(formatPersonName('   ')).toBeUndefined();
    });
});

describe('condenseToClause', () => {
    const SENTENCE = 'At Australian Events, I took content output from 50 to more than 150 assets per campaign by building AI-assisted workflows that let me produce far more without flattening the message.';

    it('cuts a long sentence back to a grammatical claim that fits', () => {
        const out = condenseToClause(SENTENCE, 95)!;
        expect(out).toBe('At Australian Events, I took content output from 50 to more than 150 assets per campaign.');
        expect(out.length).toBeLessThanOrEqual(95);
    });

    it('keeps the figure, since that is why the sentence was worth quoting', () => {
        expect(condenseToClause(SENTENCE, 30)).toBeNull();
    });

    it('does not leave a dangling conjunction where it cut', () => {
        const out = condenseToClause('I cut costs by 40%, and then I left.', 60);
        expect(out).not.toMatch(/\b(and|but|which|so)\.$/);
    });
});
