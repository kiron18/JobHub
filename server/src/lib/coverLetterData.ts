// Server-local copy of CoverLetterData type.
// Duplicated from src/lib/coverLetterData.ts to avoid rootDir import issues.
// Keep in sync manually.

export type CoverLetterData = {
  salutation: string;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  signoff: string;
};
