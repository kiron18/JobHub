/**
 * One real fit check, end to end, printed as the screen would show it.
 *
 * The paired eval measures separation across twelve cases. This is the other
 * thing you need before shipping: a single report you can read, to see the
 * work-rights line, the title, the employer and the verdict together the way a
 * candidate sees them.
 *
 *   npx tsx src/tests/fitLiveCheck.ts
 *   npx tsx src/tests/fitLiveCheck.ts TanviH.Resume.txt graduate-analyst-jd.txt
 *   npx tsx src/tests/fitLiveCheck.ts "Vijay Resume_CE.txt" civil-site-engineer-jd.txt 16
 *
 * Costs one LLM call. Needs OPENROUTER_API_KEY in server/.env
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runFitReport } from '../services/fitReport';

dotenv.config();

const REPO = path.resolve(__dirname, '../../..');
const resumeFile = process.argv[2] ?? 'TanviH.Resume.txt';
const jdFile = process.argv[3] ?? 'graduate-analyst-jd.txt';
// The years figure the profile would be carrying. Optional, because the
// seniority notice is meant to stay silent when we do not hold one.
const years = process.argv[4] ? parseInt(process.argv[4], 10) : null;

async function main() {
  const resume = fs.readFileSync(path.join(REPO, 'evals/fixtures/resumes', resumeFile), 'utf8');
  const jd = fs.readFileSync(path.join(REPO, 'evals/datasets/job-descriptions', jdFile), 'utf8');

  const { report, requirements, ms } = await runFitReport(resume, jd, years);

  console.log(`\n${resumeFile}  ->  ${jdFile}`);
  console.log(`${requirements.length} requirements read, ${ms}ms\n`);
  console.log(`  ${report.jobTitle ?? '(no title)'}`);
  console.log(`  ${report.company ?? '(no employer)'}`);
  console.log(`\n  ${report.fit}%  ${report.band}  ->  ${report.outcome}   (fit is internal, never shown)`);
  if (report.workRights) console.log(`\n  NOTICE: ${report.workRights}`);
  if (report.seniority) console.log(`\n  NOTICE: ${report.seniority}`);
  console.log(`\n  ${report.verdict}\n`);
  console.log('  What counts here:');
  report.youHave.forEach((h) => console.log(`    + ${h}`));
  console.log('  What they cannot see:');
  report.missing.forEach((m) => console.log(`    - ${m}`));
  if (report.searchRoles.length) console.log(`  Instead: ${report.searchRoles.join(', ')}`);
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
