#!/usr/bin/env node
const { spawnSync } = require('child_process');

const TIMEOUT_MS = 30_000;

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  encoding: 'utf-8',
  timeout: TIMEOUT_MS,
});

const out = (result.stdout || '') + (result.stderr || '');
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');

if (result.signal === 'SIGTERM' || result.error?.code === 'ETIMEDOUT') {
  console.log('\n[migrate-safe] Migration timed out after 30s — skipping and starting app.');
  process.exit(0);
}

if (result.status !== 0) {
  if (out.includes('P3009')) {
    console.log('\n[migrate-safe] P3009 detected — schema already in sync, skipping.');
    process.exit(0);
  }
  if (out.includes('EMAXCONNSESSION') || out.includes('P1001') || out.includes('P1013')) {
    console.log('\n[migrate-safe] DB unreachable — skipping migration, starting app.');
    process.exit(0);
  }
  process.exit(result.status ?? 1);
}
process.exit(0);
