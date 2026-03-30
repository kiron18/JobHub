// Test setup — mock external services so tests don't hit real APIs
import { vi } from 'vitest';

// Use the dev bypass so the auth middleware never touches Supabase or the log file.
// The bypass pins req.user to a fixed dev user ID; our tests override this via the
// prisma mock to point to 'test-user-id' where ownership checks are needed.
process.env.DEV_BYPASS_AUTH = 'true';

// Mock Prisma
vi.mock('../index', () => ({
  prisma: {
    candidateProfile: {
      findUnique: vi.fn(),
    },
    document: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    jobApplication: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    documentFeedback: {
      create: vi.fn(),
    },
  },
}));

// Mock Supabase auth — bypass token verification in tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  },
}));
