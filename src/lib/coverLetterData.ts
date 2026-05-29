// Shared CoverLetterData type — single source of truth for both client and server.
// Pure type file (no JSX, no runtime) so the server tsconfig can import it.

export type CoverLetterData = {
  salutation: string;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  signoff: string;
};
