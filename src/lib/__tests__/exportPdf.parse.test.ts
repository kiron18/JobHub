/**
 * Baseline lock on the resume markdown parser.
 *
 * `parseResume` decides which part of a resume each line becomes — a date, a
 * skills row, an education entry, a bullet. It uses markdown emphasis as part
 * of that decision (`*text*` on its own line is read as a date/descriptor,
 * `**Label:**` as a skills row), so any work on user-applied bold/italic can
 * silently re-classify content and scramble the PDF.
 *
 * These snapshots exist to make that impossible to do by accident: they record
 * exactly how each fixture parses today. A diff here means the structure of
 * someone's resume changed, which is the one outcome we cannot ship.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseResume } from '../exportPdf';

const fixture = (name: string) =>
    readFileSync(join(__dirname, 'fixtures', `${name}.md`), 'utf-8');

/**
 * Flatten parsed sections into a stable, human-readable shape. Deliberately
 * verbose over a raw object snapshot — when this diff shows up in review, the
 * damage (or the absence of it) should be obvious at a glance.
 */
function summarise(markdown: string): string {
    const out: string[] = [];
    for (const section of parseResume(markdown)) {
        out.push(`[${section.type}] ${section.title || '(header)'}`);
        for (const item of section.content as any[]) {
            const parts = [
                item.type ? `type=${item.type}` : null,
                item.title ? `title=${JSON.stringify(item.title)}` : null,
                item.organization ? `org=${JSON.stringify(item.organization)}` : null,
                item.dates ? `dates=${JSON.stringify(item.dates)}` : null,
                item.descriptor ? `descriptor=${JSON.stringify(item.descriptor)}` : null,
                item.label ? `label=${JSON.stringify(item.label)}` : null,
                item.values ? `values=${JSON.stringify(item.values)}` : null,
                item.text ? `text=${JSON.stringify(item.text)}` : null,
            ].filter(Boolean);
            out.push(`  - ${parts.join(' ')}`);
            for (const bullet of item.bullets ?? []) {
                out.push(`      • ${JSON.stringify(bullet)}`);
            }
            for (const note of item.notes ?? []) {
                out.push(`      ¶ ${JSON.stringify(note)}`);
            }
        }
    }
    return out.join('\n');
}

describe('parseResume — structural baseline', () => {
    it('parses a standard generated resume', () => {
        expect(summarise(fixture('standard'))).toMatchSnapshot();
    });

    it('parses a resume with inline bold on metrics', () => {
        expect(summarise(fixture('bolded'))).toMatchSnapshot();
    });

    it('parses a resume containing hazardous user-applied emphasis', () => {
        expect(summarise(fixture('hazards'))).toMatchSnapshot();
    });
});

describe('parseResume — inline emphasis must not change structure', () => {
    /**
     * The load-bearing guarantee for the bold feature: bolding a metric inside
     * a bullet is a text change, never a structural one. Same sections, same
     * roles, same bullet counts as the unbolded original.
     */
    it('keeps the same skeleton whether or not bullets carry inline bold', () => {
        const skeleton = (markdown: string) =>
            parseResume(markdown).map((section) => ({
                type: section.type,
                title: section.title,
                items: section.content.length,
                bullets: (section.content as any[]).map((i) => i.bullets?.length ?? 0),
            }));

        expect(skeleton(fixture('bolded'))).toEqual(skeleton(fixture('standard')));
    });
});
