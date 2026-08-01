/**
 * The PDF must print the headings the user actually wrote.
 *
 * `classifySection` folds every heading containing "experience" into the one
 * `experience` type, so a resume with both "Professional Experience" and
 * "Additional Experience" produces two sections of the same type. The renderer
 * used to hard-code each section's heading from that type, which printed
 * "Professional Experience" twice — on the PDF only. The preview and the Word
 * download read `section.title` and were right, so the wording was wrong on
 * exactly the copy that reaches an employer.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { parseResume, ResumeDocument } from '../exportPdf';
import { extractReactText } from '../extractReactText';

/** A section heading is the only styled text carrying the hairline rule. */
function isHeading(node: React.ReactElement): boolean {
    const style = (node.props as { style?: { borderBottomWidth?: number; textTransform?: string } }).style;
    return style?.borderBottomWidth === 0.5 && style?.textTransform === 'uppercase';
}

/** Every section heading the document renders, in page order. */
function headings(markdown: string): string[] {
    const found: string[] = [];

    const walk = (node: React.ReactNode): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!React.isValidElement(node)) return;
        if (isHeading(node)) {
            found.push(extractReactText((node.props as { children?: React.ReactNode }).children));
            return;
        }
        walk((node.props as { children?: React.ReactNode }).children);
    };

    walk(ResumeDocument({ sections: parseResume(markdown) }));
    return found;
}

const ROLE = (heading: string, title: string) => `
## ${heading}

### ${title} | Some Company
*Jan 2024 - Present*
- Did the work.
`;

describe('section headings in the PDF', () => {
    it('keeps two experience sections distinct', () => {
        const md = `# A Candidate\n${ROLE('Professional Experience', 'Analyst')}${ROLE('Additional Experience', 'Team Lead')}`;

        expect(headings(md)).toEqual(['Professional Experience', 'Additional Experience']);
    });

    it('uses the user\'s own wording rather than a canonical name', () => {
        const md = [
            '# A Candidate',
            '',
            '## Technical Skills',
            '**Languages:** TypeScript',
            '',
            '## Key Projects',
            '',
            '### Rebuild | Self',
            '- Shipped it.',
            '',
            '## Academic Background',
            '**BSc Physics** · 2020',
            'A University',
        ].join('\n');

        expect(headings(md)).toEqual(['Technical Skills', 'Key Projects', 'Academic Background']);
    });

    it('falls back to the canonical name when a section has no title', () => {
        const sections = parseResume(`# A Candidate\n${ROLE('Professional Experience', 'Analyst')}`);
        sections[sections.length - 1].title = '';

        const found: string[] = [];
        const walk = (node: React.ReactNode): void => {
            if (Array.isArray(node)) return node.forEach(walk);
            if (!React.isValidElement(node)) return;
            if (isHeading(node)) {
                found.push(extractReactText((node.props as { children?: React.ReactNode }).children));
                return;
            }
            walk((node.props as { children?: React.ReactNode }).children);
        };
        walk(ResumeDocument({ sections }));

        expect(found).toEqual(['Professional Experience']);
    });

    it('renders a section that has a heading but no entries', () => {
        const md = '# A Candidate\n\n## Referees\n';

        expect(headings(md)).toEqual(['Referees']);
    });
});

describe('page-break safety', () => {
    /** Collect every block marked unbreakable, with the text inside it. */
    function unbreakableBlocks(markdown: string): string[] {
        const found: string[] = [];
        const walk = (node: React.ReactNode): void => {
            if (Array.isArray(node)) return node.forEach(walk);
            if (!React.isValidElement(node)) return;
            const props = node.props as { wrap?: boolean; children?: React.ReactNode };
            if (props.wrap === false) {
                found.push(extractReactText(props.children));
                return;
            }
            walk(props.children);
        };
        walk(ResumeDocument({ sections: parseResume(markdown) }));
        return found;
    }

    it('binds a section heading, the first role and its first bullet into one block', () => {
        const md = [
            '# A Candidate',
            '',
            '## Professional Experience',
            '',
            '### Analyst | Some Company',
            '*Jan 2024 - Present*',
            '- First point.',
            '- Second point.',
        ].join('\n');

        const [block] = unbreakableBlocks(md);
        expect(block).toContain('Professional Experience');
        expect(block).toContain('Analyst');
        expect(block).toContain('Some Company');
        expect(block).toContain('First point.');
        // Held back deliberately: keeping a whole role together would push a
        // long one onto the next page and leave half a page blank.
        expect(block).not.toContain('Second point.');
    });

    it('binds each later role to its own first bullet, without the heading', () => {
        const md = [
            '# A Candidate',
            '',
            '## Professional Experience',
            '',
            '### Analyst | First Company',
            '- One.',
            '',
            '### Lead | Second Company',
            '- Two.',
            '- Three.',
        ].join('\n');

        const blocks = unbreakableBlocks(md);
        expect(blocks).toHaveLength(2);
        expect(blocks[1]).toContain('Lead');
        expect(blocks[1]).toContain('Second Company');
        expect(blocks[1]).toContain('Two.');
        expect(blocks[1]).not.toContain('Professional Experience');
        expect(blocks[1]).not.toContain('Three.');
    });

    it('puts every block directly on the page, so react-pdf can move any of them', () => {
        // react-pdf only honours wrap={false} on a direct child of <Page>.
        // Nested in a per-section wrapper, an oversized block is drawn into the
        // bottom margin instead of moving to the next page.
        const md = `# A Candidate\n${ROLE('Professional Experience', 'Analyst')}${ROLE('Projects', 'A Project')}`;

        const doc = ResumeDocument({ sections: parseResume(md) });
        const page = (doc.props as { children: React.ReactElement }).children;
        const blocks = React.Children.toArray((page.props as { children?: React.ReactNode }).children);

        // Header, both role blocks and nothing wrapping them.
        expect(blocks.length).toBeGreaterThanOrEqual(3);
        for (const block of blocks) {
            expect(React.isValidElement(block)).toBe(true);
            expect((block as React.ReactElement).key).toBeTruthy();
        }
    });
});
