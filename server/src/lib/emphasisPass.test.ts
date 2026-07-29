/**
 * The emphasis pass hands someone's finished resume to a model and asks for it
 * back. These tests exist for one reason: to prove that anything other than a
 * pure emphasis change is rejected, so the worst realistic outcome of the
 * feature is "no change" rather than "a damaged resume".
 */
import { describe, it, expect } from 'vitest';
import { verifyEmphasisPass, stripFences } from './emphasisPass';

const ORIGINAL = `# Vaibhav Singh

*Validation & Service Technician*

Sydney, NSW | 0467 333 893 | singh.vaibhav0510@gmail.com

## Professional Summary

I am a validation engineer with five years of production experience, comfortable working independently in the field.

## Work Experience

### Senior System Validation Engineer | MediaTek Technologies
*Jun 2017 - Sep 2022*

- Ran validation testing on India-market chipsets, reducing customer-reported bugs by 90%
- Attended operator sites onsite with Vodafone and Spark for 5G pre-deployment validation
- Reported daily to engineering and customer stakeholders on test execution and open defects

### Assistant Manager | Regent Hotel (Solotel)
*Aug 2024 - Present*

- Correlated Google reviews and revenue data in Excel, contributing to the rating rising from 4.1 to 4.4

## Education

**Master's in Signal Processing**  ·  2024
UNSW Sydney

## Skills & Competencies

**Validation & Testing:** System validation, fault finding, root-cause analysis`;

/** Emphasise a line of the original, by index, wrapping the given phrase. */
function emphasise(source: string, phrase: string): string {
    return source.replace(phrase, `**${phrase}**`);
}

describe('verifyEmphasisPass — accepting good work', () => {
    it('accepts emphasis added to bullets', () => {
        const returned = emphasise(ORIGINAL, 'reducing customer-reported bugs by 90%');
        const result = verifyEmphasisPass(ORIGINAL, returned);
        expect(result.accepted).toBe(true);
        expect(result.content).toBe(returned);
    });

    it('accepts emphasis on a bullet with no number in it at all', () => {
        // The thing a purely numeric rule can never do, and the reason for the pass.
        const returned = emphasise(ORIGINAL, 'Reported daily to engineering and customer stakeholders');
        expect(verifyEmphasisPass(ORIGINAL, returned).accepted).toBe(true);
    });

    it('accepts a single span in the professional summary', () => {
        const returned = emphasise(ORIGINAL, 'comfortable working independently in the field');
        expect(verifyEmphasisPass(ORIGINAL, returned).accepted).toBe(true);
    });

    it('rejects a pass that strips the document bare rather than re-deciding', () => {
        // Removing emphasis is legitimate, but a document returned with none at
        // all is indistinguishable from the model having ignored the task — so
        // the original stands and the deterministic pass takes over.
        const before = emphasise(ORIGINAL, 'from 4.1 to 4.4');
        const result = verifyEmphasisPass(before, ORIGINAL);
        expect(result.accepted).toBe(false);
        expect(result.reason).toMatch(/nothing was emphasised/);
        expect(result.content).toBe(before);
    });

    it('accepts a document where emphasis moved from one bullet to another', () => {
        const before = emphasise(ORIGINAL, 'from 4.1 to 4.4');
        const after = emphasise(ORIGINAL, 'Attended operator sites onsite with Vodafone and Spark');
        expect(verifyEmphasisPass(before, after).accepted).toBe(true);
    });

    it('tolerates the model wrapping the document in code fences', () => {
        const returned = '```markdown\n' + emphasise(ORIGINAL, 'by 90%') + '\n```';
        expect(verifyEmphasisPass(ORIGINAL, returned).accepted).toBe(true);
    });
});

describe('verifyEmphasisPass — rejecting anything else', () => {
    const rejects = (returned: string) => {
        const result = verifyEmphasisPass(ORIGINAL, returned);
        expect(result.accepted).toBe(false);
        expect(result.content).toBe(ORIGINAL);
        return result.reason;
    };

    it('rejects a reworded bullet', () => {
        expect(rejects(ORIGINAL.replace('Ran validation testing', 'Led validation testing')))
            .toMatch(/beyond emphasis/);
    });

    it('rejects a silently corrected typo', () => {
        expect(rejects(ORIGINAL.replace('Vodafone', 'Vodaphone'))).toMatch(/beyond emphasis/);
    });

    it('rejects a dropped line', () => {
        const returned = ORIGINAL.split('\n').filter((l) => !l.includes('Reported daily')).join('\n');
        expect(rejects(returned)).toMatch(/line count changed/);
    });

    it('rejects an added line', () => {
        expect(rejects(ORIGINAL + '\n- Invented an extra achievement')).toMatch(/line count changed/);
    });

    it('rejects emphasis on a heading', () => {
        expect(rejects(ORIGINAL.replace('## Work Experience', '## **Work Experience**')))
            .toMatch(/not eligible/);
    });

    it('rejects emphasis on a date line', () => {
        // Whole-line emphasis on a date is exactly what scrambles the PDF layout.
        expect(rejects(ORIGINAL.replace('*Jun 2017 - Sep 2022*', '**Jun 2017 - Sep 2022**')))
            .toMatch(/not eligible/);
    });

    it('rejects emphasis on the candidate name', () => {
        expect(rejects(ORIGINAL.replace('# Vaibhav Singh', '# **Vaibhav Singh**')))
            .toMatch(/not eligible/);
    });

    it('rejects a structural skills row being restyled', () => {
        expect(rejects(ORIGINAL.replace('**Validation & Testing:**', '**Validation & Testing**:')))
            .toMatch(/not eligible/);
    });

    it('rejects two emphasised spans in a single bullet', () => {
        const returned = ORIGINAL.replace(
            '- Ran validation testing on India-market chipsets, reducing customer-reported bugs by 90%',
            '- Ran **validation testing** on India-market chipsets, reducing customer-reported bugs by **90%**',
        );
        expect(rejects(returned)).toMatch(/more than one/);
    });

    it('rejects a document with nothing emphasised', () => {
        expect(rejects(ORIGINAL)).toMatch(/nothing was emphasised/);
    });

    it('rejects an empty response', () => {
        expect(rejects('')).toMatch(/empty response/);
        expect(rejects('   \n  ')).toMatch(/empty response/);
    });

    it('rejects the model answering with prose instead of the document', () => {
        expect(rejects('Here is the resume with the key results emphasised:')).toBeTruthy();
    });
});

describe('verifyEmphasisPass — the ceiling', () => {
    it('rejects a document emphasised past the ceiling', () => {
        const many = ['## Work Experience', '']
            .concat(Array.from({ length: 15 }, (_, i) => `- Improved result ${i} by **${i + 1}%**`))
            .join('\n');
        const plain = many.replace(/\*\*/g, '');
        const result = verifyEmphasisPass(plain, many);
        expect(result.accepted).toBe(false);
        expect(result.reason).toMatch(/exceeds the ceiling/);
    });

    it('accepts a document sitting exactly on the ceiling', () => {
        const lines = ['## Work Experience', '']
            .concat(Array.from({ length: 12 }, (_, i) => `- Improved result ${i} by **${i + 1}%**`));
        const many = lines.join('\n');
        expect(verifyEmphasisPass(many.replace(/\*\*/g, ''), many).accepted).toBe(true);
    });
});

describe('stripFences', () => {
    it('removes a markdown-tagged fence', () => {
        expect(stripFences('```markdown\n# Name\n```')).toBe('# Name');
    });

    it('removes a bare fence', () => {
        expect(stripFences('```\n# Name\n```')).toBe('# Name');
    });

    it('leaves an unfenced document alone', () => {
        expect(stripFences('# Name\n\nBody')).toBe('# Name\n\nBody');
    });
});
