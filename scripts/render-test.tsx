// Temporary render harness: renders the resume PDF in node and reports
// page count + parsed content. Run from public/ so ./fonts/ resolves:
//   cd public && npx tsx ../scripts/render-test.tsx <markdown-file>
import fs from 'fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { parseResume, ResumeDocument } from '../src/lib/exportPdf';

async function main() {
    const mdPath = process.argv[2];
    const markdown = fs.readFileSync(mdPath, 'utf-8');

    const sections = parseResume(markdown);
    console.log('--- Parsed sections ---');
    for (const s of sections) {
        const items = s.content.map((c: any) =>
            c.title || c.label || (c.text ? c.text.slice(0, 40) : '?')
        );
        console.log(`${s.type} (${s.title || 'header'}): ${items.length} items`);
        for (const c of s.content as any[]) {
            const flags = [
                c.dates ? `dates="${c.dates}"` : null,
                c.descriptor ? `desc="${String(c.descriptor).slice(0, 40)}..."` : null,
                c.bullets?.length ? `${c.bullets.length} bullets` : null,
            ].filter(Boolean).join(' ');
            if (c.title || flags) console.log(`   - ${(c.title || c.label || '').slice(0, 50)} ${flags}`);
        }
    }

    const buf = await renderToBuffer(<ResumeDocument sections={sections} />);
    const str = buf.toString('latin1');
    const pages = (str.match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`\n--- PDF: ${pages} pages, ${(buf.length / 1024).toFixed(0)} KB ---`);
    fs.writeFileSync(mdPath.replace(/\.md$/, '.pdf'), buf);
}

main().catch((e) => { console.error(e); process.exit(1); });
