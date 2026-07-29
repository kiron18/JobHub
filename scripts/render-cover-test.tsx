// Render harness for the cover letter PDF, mirroring render-test.tsx.
// Run from public/ so ./fonts/ resolves:
//   cd public && npx tsx ../scripts/render-cover-test.tsx <markdown-file>
import fs from 'fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { CoverLetterDocument, parseCoverLetter } from '../src/lib/exportPdf';

async function main() {
    const mdPath = process.argv[2];
    const markdown = fs.readFileSync(mdPath, 'utf-8');

    const parsed = parseCoverLetter(markdown);
    console.log('--- Parsed blocks ---');
    console.log(`contact:   ${parsed.contactBlock.length} line(s)`);
    console.log(`date:      ${parsed.date || '(none)'}`);
    console.log(`salutation:${parsed.salutation || '(none)'}`);
    console.log(`body:      ${parsed.bodyParagraphs.length} paragraph(s)`);
    console.log(`signoff:   ${parsed.signoff.length} line(s)`);

    const buf = await renderToBuffer(<CoverLetterDocument content={markdown} />);
    fs.writeFileSync(mdPath.replace(/\.md$/, '.pdf'), buf);
    console.log(`\n--- PDF: ${(buf.length / 1024).toFixed(0)} KB ---`);
}

main().catch((e) => { console.error(e); process.exit(1); });
