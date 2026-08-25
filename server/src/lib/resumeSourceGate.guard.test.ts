import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The gate is only worth having if it cannot be walked around.
 *
 * resumeRawText is the source of truth every generation is built from and
 * graded against, so a write that skips lib/resumeSourceGate can put an
 * unverifiable figure beyond the reach of every later check. This test finds
 * every file that assigns the field and insists it goes through the gate.
 *
 * If this fails because you added a legitimate new writer: import
 * assertResumeSource and call it before your write. That is the fix, not adding
 * yourself to an exemption list.
 */
const SRC = path.join(__dirname, '..');

/** Assignments only. Excludes `resumeRawText: true` (a Prisma select) and type positions. */
const WRITE = /resumeRawText:[ \t]*(?!true\b|string\b|boolean\b|number\b)[^\s,;\n]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'tests', 'scripts'].includes(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('the resumeRawText gate cannot be bypassed', () => {
  it('every file that writes the field also calls the gate', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const body = fs.readFileSync(file, 'utf8');
      if (!WRITE.test(body)) continue;
      // Reads that merely copy the field into a response object are not writes.
      if (/resumeRawText:\s*\w+\??\.\w*resumeRawText/.test(body)) continue;
      if (body.includes('assertResumeSource')) continue;
      offenders.push(path.relative(SRC, file).split(path.sep).join('/'));
    }

    expect(offenders).toEqual([]);
  });
});
