/**
 * One-off: run the deterministic work-rights read over every eval job ad and
 * every real advert in the tracker sample, and print what it would say. No LLM,
 * no cost. Exists so the sentence can be eyeballed against real ads before it
 * goes in front of anyone.
 *
 *   npx tsx src/tests/workRightsScan.ts
 */
import fs from 'fs';
import path from 'path';
import { detectWorkRights } from '../lib/workRights';

const dir = path.resolve(__dirname, '../../../evals/datasets/job-descriptions');
for (const file of fs.readdirSync(dir)) {
  const jd = fs.readFileSync(path.join(dir, file), 'utf8');
  const notice = detectWorkRights(jd);
  console.log(`\n${file}`);
  console.log(notice ? `  -> ${notice.sentence}` : '  -> (nothing said)');
}
