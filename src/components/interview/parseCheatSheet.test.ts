import { describe, it, expect } from 'vitest';
import { isCheatSheet, parseCheatSheet } from './parseCheatSheet';

// A prep in the shape the rules ask for, with the three things the model does
// anyway: bold on markers, scripts wrapped over several lines, and a numbered
// question list where the rules asked for Q:.
const DOC = `### ONE RULE

Do not try to convince them you are the perfect candidate. Give them enough
evidence that they convince themselves.

### OPENING

SAY: "I come from a background in data integrity and process. For the past three
years I have been working with messy operational data, finding where the numbers
do not reconcile."
WHY: The recruiter hears data integrity before they get anywhere near the
question of billing experience.

### THE GAP

GAP: No dedicated billing system experience
**SAY:** "Not in a dedicated billing system. My experience is in the adjacent problem."
WHY: That is the only place you acknowledge the gap.

### IN THE AD

- QUOTE: "rather than a purely technical IT background" || Do not let them file you as an IT person. Lead with business, mention systems second.
- QUOTE: "experience setting up new customers" || That is a direct hit. IT Mate is the answer, have it loaded.

### PROOF POINTS

- ASKS: Setting up new customers and operational processes || SAYS: IT Mate. Built one repeatable onboarding process for a firm running 50+ SME clients. Cut turnaround by 30 to 40%.
- ASKS: Charge validation and reconciliation || SAYS: Mega Mulchers. Traced pricing gaps across sales and supply-chain data. Contributed to a 20% revenue uplift.
- ASKS: Data integrity || SAYS: Care To Heal. Built a single source of truth. Roughly 90% faster.
- ASKS: Primary contact across Operations and Finance || SAYS: Monash MIG. Liaison between 56 postgraduate students and their industry partners. 95% satisfaction.

SPARE: Root cause and practical fix || MCM. The simulation exposed 23-day cycle times, the redesign brought that to about a day.

CAUTION: The 8-person operations team is not on the resume in front of them. Introduce it rather than assuming they can see it.

### SHOW DONT SAY

- CLICHE: I'm a fast learner || INSTEAD: "I had not worked with that system before, so I started with the process and how the data moved through it."
- CLICHE: I'm good with stakeholders || INSTEAD: "At Care To Heal, intake and compliance both wanted something different out of the same form. I built one process that covered both."

### LIKELY QUESTIONS

1. Tell me about yourself.
SAY: "Business analyst, Master of Business Information Systems from Monash, close
to three years across consulting and SMEs."
TACTIC: Under 45 seconds. Then stop talking.

2. Have you used SAP or Blue Yonder?
SAY: "No. My enterprise work has been Power BI over multi-source data and SQL."
BACK: "How much of the first three months is usually system ramp-up?"

3. What are your salary expectations?
TACTIC: Ask first. If they push for a number, mid-eighties to mid-nineties plus super.

### CANNOT FUMBLE

- ITEM: Work rights || Know your visa type and expiry before you dial. Say the type, the date, and what happens next, in that order.
- ITEM: The checks || The ad states a criminal history check and a full medical. Do not react to it.

### BEFORE THE CALL

- Know what a rate card, a charge code and a billing run are.
- Linfox basics. Started 1956, around 24,000 people.
- Resume and job ad open, this page next to them. Somewhere quiet.

### YOUR QUESTIONS

- What does a bad day in this role look like?
- Which business units are onboarding first?

CLOSE: "That has confirmed my interest. What are the next steps?"

### TONE

- Two-second pause before every answer.
- Do not fill the silence.

### IN ONE PARAGRAPH

You are not there to prove you have done this exact job before. You are there to
make one connection obvious.
`;

describe('cheat sheet parser', () => {
    const sheet = parseCheatSheet(DOC);

    it('recognises the new format and rejects the legacy one', () => {
        expect(isCheatSheet(DOC)).toBe(true);
        expect(isCheatSheet('### Your Edge\n**Why You:** something\n### 2. Story Bank')).toBe(false);
        expect(isCheatSheet('')).toBe(false);
    });

    it('joins a script that wraps over several lines', () => {
        expect(sheet.opening?.say).toContain('data integrity and process');
        expect(sheet.opening?.say).toContain('do not reconcile');
        expect(sheet.opening?.say).not.toContain('"');
        expect(sheet.opening?.why).toContain('before they get anywhere near');
    });

    it('reads markers through stray bold', () => {
        expect(sheet.gap?.label).toBe('No dedicated billing system experience');
        expect(sheet.gap?.say).toMatch(/^Not in a dedicated billing system/);
    });

    it('splits paired lines and drops their labels', () => {
        expect(sheet.inTheAd).toHaveLength(2);
        expect(sheet.inTheAd[0].left).toBe('rather than a purely technical IT background');
        expect(sheet.inTheAd[0].right).toMatch(/^Do not let them file you/);

        expect(sheet.proofPoints).toHaveLength(4);
        expect(sheet.proofPoints[0].left).toBe('Setting up new customers and operational processes');
        expect(sheet.proofPoints[0].right).toMatch(/^IT Mate\./);
    });

    it('keeps spares out of the proof point table', () => {
        expect(sheet.spares).toHaveLength(1);
        expect(sheet.spares[0].left).toBe('Root cause and practical fix');
        expect(sheet.caution).toMatch(/^The 8-person operations team/);
    });

    it('reads the cliche swaps', () => {
        expect(sheet.showDontSay).toHaveLength(2);
        expect(sheet.showDontSay[0].left).toBe("I'm a fast learner");
        expect(sheet.showDontSay[0].right).toMatch(/^I had not worked with that system/);
    });

    it('accepts a numbered question list and attaches each field to its question', () => {
        expect(sheet.questions).toHaveLength(3);
        expect(sheet.questions[0].q).toBe('Tell me about yourself.');
        expect(sheet.questions[0].say).toContain('Master of Business Information Systems');
        expect(sheet.questions[0].tactic).toBe('Under 45 seconds. Then stop talking.');
        expect(sheet.questions[1].back).toMatch(/^How much of the first three months/);
        expect(sheet.questions[2].say).toBe('');
        expect(sheet.questions[2].tactic).toMatch(/^Ask first/);
    });

    it('reads the lists, the close, and both paragraphs', () => {
        expect(sheet.cannotFumble).toHaveLength(2);
        expect(sheet.cannotFumble[0].left).toBe('Work rights');
        expect(sheet.beforeCall).toHaveLength(3);
        expect(sheet.yourQuestions).toHaveLength(2);
        expect(sheet.close).toMatch(/^That has confirmed my interest/);
        expect(sheet.tone).toHaveLength(2);
        expect(sheet.oneRule).toBe('Do not try to convince them you are the perfect candidate. Give them enough evidence that they convince themselves.');
        expect(sheet.onePara).toContain('make one connection obvious');
    });

    // A real generated prep put `---` between every section and used `##`
    // headings with bold markers. The rule lines were being appended to the
    // last bullet of whatever list they followed.
    it('ignores horizontal rules between sections', () => {
        const withRules = parseCheatSheet(`## BEFORE THE CALL
- Test your setup: quiet space, phone charged.
---
## TONE
- Two-second pause before every answer.
***
## IN ONE PARAGRAPH
You are there to make one connection obvious.`);
        expect(withRules.beforeCall).toEqual(['Test your setup: quiet space, phone charged.']);
        expect(withRules.tone).toEqual(['Two-second pause before every answer.']);
        expect(withRules.onePara).toBe('You are there to make one connection obvious.');
    });

    // Real output wraps cannot-fumble values and asked-questions in quotes, and
    // writes the item label in caps. The page supplies its own quote marks.
    it('unwraps quotes the model added itself', () => {
        const q = parseCheatSheet(`## CANNOT FUMBLE
- WORK RIGHTS || "I am on a Graduate Work Visa, subclass 485."
## YOUR QUESTIONS
- "What does success look like in the first six months?"
CLOSE: "What are the next steps?"`);
        expect(q.cannotFumble[0].right).toBe('I am on a Graduate Work Visa, subclass 485.');
        expect(q.cannotFumble[0].left).toBe('WORK RIGHTS');
        expect(q.yourQuestions[0]).toBe('What does success look like in the first six months?');
        expect(q.close).toBe('What are the next steps?');
    });

    it('never returns undefined fields for an empty doc', () => {
        const empty = parseCheatSheet('');
        expect(empty.proofPoints).toEqual([]);
        expect(empty.opening).toBeNull();
        expect(empty.oneRule).toBe('');
    });
});
