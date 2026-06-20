// OWNED BY CLAUDE. Do not rewrite. Mechanics only may be wired around it.
// Turns a full scraped job page (nav, related jobs, company marketing, apply
// boilerplate, cookie banners) into the essential posting a job seeker actually
// needs to scan in a few seconds, and that the resume/cover-letter generator
// needs to tailor against. Keeps the signal (what the job is, what it needs),
// drops the noise.
export const CONCISE_JD_PROMPT = (markdown: string): string => `You are extracting the essential job posting from the scraped text of a job page. The raw text is cluttered with site navigation, related job links, company marketing, cookie banners, and "how to apply" boilerplate. Strip all of that out.

Return a clean, scannable description of THIS one job, in plain text. Include, in this order, only what is genuinely present:

1. A one or two sentence summary of what the role is.
2. "What you'll do:" followed by 3 to 6 short bullet points (each starting with "- ") covering the main responsibilities.
3. "What they're looking for:" followed by 3 to 6 short bullet points (each starting with "- ") covering the key requirements or qualifications.
4. A final line for any of these that are stated: employment type (full-time, part-time, casual, contract), salary, location. Put each on its own short line like "Salary: ..." only if present.

Rules:
- Use ONLY information genuinely present in the text. Never invent a responsibility, requirement, salary, or any detail. If something is not stated, leave it out entirely.
- Do not output a section header if that section has no real content. Never write "Not specified" or "N/A".
- Keep it tight and skimmable: aim for roughly 120 to 200 words total. This is for someone scanning fast, not the full legal posting.
- Do NOT use em dashes or en dashes anywhere. Use commas, or rewrite the sentence.
- No markdown headings (#), no bold, no code fences. Plain text with simple "- " bullets only.
- Output only the description itself. No preamble like "Here is", no closing remarks.

RAW PAGE TEXT:
${markdown}`;
