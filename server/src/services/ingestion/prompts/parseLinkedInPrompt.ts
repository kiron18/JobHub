// OWNED BY CLAUDE. Do not rewrite. Mechanics only may be wired around it.
export const PARSE_LINKEDIN_PROMPT = (markdown: string): string => `You are extracting job listings from the markdown of a LinkedIn jobs search-results page (the public guest job cards).

Return ONLY a JSON array. Each element is one job actually present on the page:
{
  "title": string,
  "company": string,
  "location": string | null,
  "salary": string | null,
  "sourceUrl": string,    // the absolute linkedin.com/jobs/view/<id> link for that job
  "teaser": string | null // the short snippet/summary shown on the card, if any
}

Rules:
- Extract ONLY jobs that genuinely appear on the page. Never invent a job, company, or field.
- If a field is not present on a card, use null. Do not guess.
- sourceUrl MUST be the absolute https://www.linkedin.com/jobs/view/<id> link for that job. Skip any card with no link.
- Do not include "promoted"/ad blurbs, navigation, footer links, or "people also viewed" links.
- Output the JSON array and nothing else. No prose, no code fences.

PAGE MARKDOWN:
${markdown}`;
