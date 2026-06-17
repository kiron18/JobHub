// OWNED BY CLAUDE. Do not rewrite. Mechanics only may be wired around it.
export const PARSE_SEEK_PROMPT = (markdown: string): string => `You are extracting job listings from the markdown of a SEEK search-results page.

Return ONLY a JSON array. Each element is one job actually present on the page:
{
  "title": string,
  "company": string,
  "location": string | null,
  "salary": string | null,
  "workMode": "onsite" | "hybrid" | "remote" | null,
  "sourceUrl": string,   // the https://au.seek.com/job/<id> link for that card, id preserved
  "teaser": string | null // the short highlight text on the card, if any
}

Rules:
- Extract ONLY jobs that genuinely appear on the page. Never invent a job, company, or field.
- If a field is not present on a card, use null. Do not guess.
- sourceUrl MUST be the canonical https://au.seek.com/job/<numeric-id> form. Strip query strings and fragments.
- Do not include markdown, navigation links, related searches, or career-advice links.
- Output the JSON array and nothing else. No prose, no code fences.

PAGE MARKDOWN:
${markdown}`;
