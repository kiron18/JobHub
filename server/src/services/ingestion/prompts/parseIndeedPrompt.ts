// OWNED BY CLAUDE. Do not rewrite. Mechanics only may be wired around it.
export const PARSE_INDEED_PROMPT = (markdown: string): string => `You are extracting job listings from the markdown of an Indeed Australia (au.indeed.com) search-results page.

Return ONLY a JSON array. Each element is one job actually present on the page:
{
  "title": string,
  "company": string,
  "location": string | null,
  "salary": string | null,
  "sourceUrl": string,    // the absolute au.indeed.com link to that specific job's detail page
  "teaser": string | null // the short snippet/summary shown on the card, if any
}

Rules:
- Extract ONLY jobs that genuinely appear on the page. Never invent a job, company, or field.
- If a field is not present on a card, use null. Do not guess.
- sourceUrl MUST be the absolute https://au.indeed.com/... link for that job. Skip any card with no link.
- Do not include ads, sponsored-search chips, "people also searched", filters, navigation, or related-search links.
- Output the JSON array and nothing else. No prose, no code fences.

PAGE MARKDOWN:
${markdown}`;
