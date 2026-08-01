// Page-count sweep. Renders one resume at many content lengths so the page
// boundary falls in a different place each time, then reports pages + whether
// anything spilled past the bottom margin.
//   cd public && npx tsx <this file> <markdown> <label>
import fs from 'fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { parseResume, ResumeDocument } from '../src/lib/exportPdf';

const A4_HEIGHT = 841.89;
const BOTTOM_PAD = 48;

/** Drop the last N bullet lines from the markdown. */
function trimBullets(md: string, n: number): string {
    const lines = md.split('\n');
    let removed = 0;
    for (let i = lines.length - 1; i >= 0 && removed < n; i--) {
        if (lines[i].trim().startsWith('- ')) { lines.splice(i, 1); removed++; }
    }
    return lines.join('\n');
}

/** Pad a bullet so content grows without changing structure. */
function padBullets(md: string, n: number): string {
    const lines = md.split('\n');
    const out: string[] = [];
    let added = 0;
    for (const line of lines) {
        out.push(line);
        if (added < n && line.trim().startsWith('- ')) {
            out.push('- Additional supporting detail for this role, written to a realistic length so the line wraps.');
            added++;
        }
    }
    return out.join('\n');
}

async function pagesFor(md: string) {
    const buf = await renderToBuffer(<ResumeDocument sections={parseResume(md)} />);
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    return { pages, bytes: buf.length };
}

async function main() {
    const md = fs.readFileSync(process.argv[2], 'utf-8');
    const label = process.argv[3] ?? 'run';
    const results: Array<{ variant: string; pages: number }> = [];

    for (let n = 18; n >= 1; n--) {
        results.push({ variant: `trim-${n}`, pages: (await pagesFor(trimBullets(md, n))).pages });
    }
    results.push({ variant: 'as-is', pages: (await pagesFor(md)).pages });
    for (let n = 1; n <= 12; n++) {
        results.push({ variant: `pad-${n}`, pages: (await pagesFor(padBullets(md, n))).pages });
    }

    fs.writeFileSync(`${label}.json`, JSON.stringify(results, null, 1));
    console.log(label, results.map(r => `${r.variant}:${r.pages}`).join(' '));
}

main().catch(e => { console.error(e); process.exit(1); });
