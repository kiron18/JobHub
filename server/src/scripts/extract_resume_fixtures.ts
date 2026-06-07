/**
 * One-time script to extract resume text from PDF/DOCX files with PII redaction.
 *
 * Usage: npx tsx server/src/scripts/extract_resume_fixtures.ts
 *
 * Reads from E:/AntiGravity/JobHub/Resumes/
 * Writes redacted .txt files to evals/fixtures/resumes/
 */
import fs from 'fs';
import path from 'path';
import { extractTextFromBuffer } from '../services/pdf';

const RESUMES_DIR = 'E:/AntiGravity/JobHub/Resumes';
const OUTPUT_DIR = 'E:/AntiGravity/JobHub/evals/fixtures/resumes';

// PII patterns to redact
const PII_PATTERNS: RegExp[] = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Australian phone numbers (0412 345 678, +61 412 345 678, etc.)
  /(\+?61)?[\s-]?[0-9]{4}[\s-]?[0-9]{3}[\s-]?[0-9]{3}/g,
  // LinkedIn URLs
  /linkedin\.com\/[^\s\n,)]+/gi,
];

function redactPii(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(RESUMES_DIR).filter(f =>
    f.endsWith('.pdf') || f.endsWith('.docx')
  );

  console.log(`Found ${files.length} resume files`);

  for (const file of files) {
    const filePath = path.join(RESUMES_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const mimeType = file.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    console.log(`  Extracting: ${file}`);
    const text = await extractTextFromBuffer(buffer, mimeType, file);
    if (!text || text.trim().length < 100) {
      console.warn(`    ⚠️  Short/minimal text extracted (${text.trim().length} chars) — skipping`);
      continue;
    }

    // Redact PII
    const redacted = redactPii(text);

    // Write to .txt file (replace extension)
    const outName = path.basename(file, path.extname(file)) + '.txt';
    const outPath = path.join(OUTPUT_DIR, outName);
    fs.writeFileSync(outPath, redacted, 'utf-8');
    console.log(`    → ${outName} (${redacted.length} chars)`);
  }

  console.log('\nDone. Redacted texts written to:', OUTPUT_DIR);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
