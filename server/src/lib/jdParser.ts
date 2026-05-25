export interface ParsedJD {
  hasEmployerQuestions: boolean;
  employerQuestions: string[];
  warning?: string;
}

const SEEK_QUESTION_BLOCK_PATTERNS = [
  /your application will include the following questions/i,
  /employer questions?[:\s]/i,
  /which of the following statements best describes your right to work/i,
];

const QUESTION_LINE = /^[\s•\-*]*(?:\d+[.\)]\s*)?(.+\?)\s*$/gm;

const SEEK_SHAPE_HINTS = [
  /posted \d+d ago/i,
  /^\s*Full time\s*$/m,
  /^\s*\$\d+/m,
  /view all (?:similar )?jobs/i,
];

export function parseJD(jd: string): ParsedJD {
  const hasQuestionBlock = SEEK_QUESTION_BLOCK_PATTERNS.some(p => p.test(jd));
  let employerQuestions: string[] = [];

  if (hasQuestionBlock) {
    const blockIndex = Math.min(
      ...SEEK_QUESTION_BLOCK_PATTERNS.map(p => {
        const m = jd.search(p);
        return m >= 0 ? m : Infinity;
      })
    );
    if (blockIndex >= 0 && blockIndex < Infinity) {
      const block = jd.slice(blockIndex);
      const matches = [...block.matchAll(QUESTION_LINE)];
      employerQuestions = matches.map(m => m[1].trim()).filter(q => q.length > 10);
    }
  }

  const looksLikeSeek = SEEK_SHAPE_HINTS.filter(p => p.test(jd)).length >= 2;
  const warning = (looksLikeSeek && !hasQuestionBlock)
    ? 'JD appears to be from Seek but the employer-question block is missing. Scroll to the bottom of the Seek posting and paste the question block — your cover letter will pre-empt qualifying questions.'
    : undefined;

  return { hasEmployerQuestions: hasQuestionBlock, employerQuestions, warning };
}
