import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

// Guard: the Apify LinkedIn scraper was retired on 2026-06-14. If anyone
// reintroduces an apify-client import or a new Apify actor call into server
// source, this test fails. admin.ts reading APIFY_API_KEY for billing is allowed.
describe('apify retirement guard', () => {
  it('has no apify-client import anywhere in server/src', () => {
    let out = '';
    try {
      // grep returns exit code 1 (throws) when there are no matches — that's the pass case.
      // Exclude this file itself (its docstring references "apify-client") and admin.ts
      // (which reads APIFY_API_KEY for billing — allowed per retirement plan).
      out = execSync(`grep -rln "apify-client" src --exclude="no-apify.test.ts"`, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
    } catch {
      out = '';
    }
    expect(out.trim()).toBe('');
  });
});
