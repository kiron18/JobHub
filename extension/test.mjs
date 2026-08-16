#!/usr/bin/env node
// Every suite, one command:  node test.mjs
// Add --verbose to see each suite's own output.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');

const SUITES = [
  ['reader', 'reader/capture.test.mjs'],
  ['matcher', 'matcher/matcher.test.mjs'],
  ['context', 'matcher/context.test.mjs'],
  ['profile', 'matcher/profile.test.mjs'],
  ['bank', 'matcher/bank.test.mjs'],
  ['intake', 'intake/intake.test.mjs'],
  ['options', 'options.test.mjs'],
  ['package', 'package.test.mjs'],
  ['end to end', 'e2e.test.mjs'],
];

let total = 0, broken = 0;
const rows = [];

for (const [name, file] of SUITES) {
  const run = spawnSync(process.execPath, [join(here, file)], { cwd: here, encoding: 'utf8' });
  const out = `${run.stdout || ''}${run.stderr || ''}`;
  if (verbose) console.log(`\n===== ${name} =====\n${out}`);

  const score = out.match(/(\d+)\/(\d+) passed/);
  const failures = (out.match(/^FAIL {2}.*$/gm) || []);
  const ok = run.status === 0;
  total += score ? Number(score[2]) : 0;
  if (!ok) broken++;

  rows.push(`${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(11)} ${score ? `${score[1]}/${score[2]}` : 'did not report'}`);
  for (const line of failures) rows.push(`        ${line}`);
  if (!ok && !score) rows.push(`        ${out.trim().split('\n').slice(-3).join('\n        ')}`);
}

console.log(rows.join('\n'));
console.log(`\n${SUITES.length - broken}/${SUITES.length} suites, ${total} checks`);
process.exit(broken ? 1 : 0);
