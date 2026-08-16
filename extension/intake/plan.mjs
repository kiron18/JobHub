#!/usr/bin/env node
// Resume in, interview out.
//
//   node intake/plan.mjs resume.txt
//   node intake/plan.mjs resume.txt --industry health
//   node intake/plan.mjs resume.txt --scaffold priya-bank.json
//   node intake/plan.mjs resume.txt --json
//
// The script it prints is meant to be read out on a call and answered out loud.
// The scaffold it writes is the empty bank those answers get typed into, which
// is then loaded into the extension.

import { readFileSync, writeFileSync } from 'node:fs';
import { planIntake, formatScript, buildScaffold } from './intake.js';
import { INDUSTRY_THEMES } from '../matcher/taxonomy.js';

// Flags that take a value, so their value is never mistaken for the filename.
const VALUED = new Set(['industry', 'scaffold']);

const flags = {};
const positional = [];
for (let i = 0, argv = process.argv.slice(2); i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  const name = arg.slice(2);
  flags[name] = VALUED.has(name) ? argv[++i] : true;
}

const file = positional[0];
if (!file || flags.help) {
  console.log(`Usage: node intake/plan.mjs <resume.txt> [--industry ${Object.keys(INDUSTRY_THEMES).join('|')}] [--scaffold out.json] [--json]`);
  process.exit(file ? 0 : 1);
}

const industry = flags.industry || null;
if (industry && !INDUSTRY_THEMES[industry]) {
  console.error(`Unknown industry "${industry}". Use one of: ${Object.keys(INDUSTRY_THEMES).join(', ')}`);
  process.exit(1);
}

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

const plan = planIntake(text, { industry });

if (flags.json) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(formatScript(plan));
}

const scaffoldPath = flags.scaffold;
if (typeof scaffoldPath === 'string') {
  // The industry the script was built for is the same one the matcher needs
  // later to turn on the safety/procedure/ethics themes.
  const scaffold = buildScaffold(plan, { profile: industry ? { industry } : {} });
  writeFileSync(scaffoldPath, `${JSON.stringify(scaffold, null, 2)}\n`, 'utf8');
  console.log(`\nScaffold written to ${scaffoldPath}`);
  console.log(`${scaffold.stories.length} story slots and ${scaffold.statements.length} statement slots, all empty.`);
  console.log('Fill "raw" from what they say on the call, then cut the four variants. It will not load until they have text.');
}
