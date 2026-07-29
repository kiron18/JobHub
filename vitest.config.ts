import { defineConfig } from 'vitest/config';

// Front-end unit tests. Deliberately narrow: `src/**` only, so this never
// picks up the server suite (which has its own vitest config) or anything
// under node_modules / .claude worktrees.
export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        environment: 'node',
    },
});
