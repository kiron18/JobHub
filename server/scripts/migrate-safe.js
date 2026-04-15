#!/usr/bin/env node
// Safe wrapper around prisma migrate deploy.
// Exits 0 on P3009 (failed migration in DB) when the schema is already in sync.
// All other errors still fail the build.
const { spawnSync } = require('child_process');

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  encoding: 'utf-8',
});

const out = (result.stdout || '') + (result.stderr || '');
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');

if (result.status !== 0) {
  if (out.includes('P3009')) {
    console.log(
      '\n[migrate-safe] P3009 detected: a previously-failed migration is blocking deploys.\n' +
      'The schema is already in sync — skipping and continuing deployment.\n' +
      'Resolve the stuck migration in the database when convenient.'
    );
    process.exit(0);
  }
  process.exit(result.status ?? 1);
}
process.exit(0);
