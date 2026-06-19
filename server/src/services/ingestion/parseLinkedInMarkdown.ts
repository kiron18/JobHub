import type { RawJob } from '../jobFeed';
import { callClaude } from '../llm';
import { PARSE_LINKEDIN_PROMPT } from './prompts/parseLinkedInPrompt';

// Fast structured-extraction model for card parsing. Env-overridable; matches SEEK.
const PARSE_MODEL = process.env.SEEK_PARSE_MODEL || 'anthropic/claude-haiku-4-5';

interface ParsedCard {
  title: string; company: string; location: string | null; salary: string | null;
  sourceUrl: string; teaser: string | null;
}

// Canonicalise to the stable https://www.linkedin.com/jobs/view/<id> form.
function canonicalUrl(url: string): string {
  const m = url.match(/linkedin\.com\/jobs\/view\/(\d+)/);
  return m ? `https://www.linkedin.com/jobs/view/${m[1]}` : url.split('?')[0].split('#')[0];
}

export async function parseLinkedInMarkdown(markdown: string): Promise<RawJob[]> {
  try {
    // Truncate to ~15k chars to stay within token limits
    const truncated = markdown.slice(0, 15000);
    const { content } = await callClaude(PARSE_LINKEDIN_PROMPT(truncated), true, undefined, PARSE_MODEL);
    console.log(`[LinkedIn Parse] Response length: ${content?.length || 0}`);
    let cards: ParsedCard[];
    try {
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']');
      cards = JSON.parse(content.slice(start, end + 1));
    } catch {
      console.log('[LinkedIn Parse] JSON parse failed');
      return [];
    }
    console.log(`[LinkedIn Parse] Parsed ${cards.length} cards`);
    return cards
      .filter(c => c && c.title && c.company && c.sourceUrl)
      .map(c => ({
        title: c.title,
        company: c.company,
        location: c.location ?? '',
        salary: c.salary ?? null,
        description: c.teaser ?? '',
        sourceUrl: canonicalUrl(c.sourceUrl),
        sourcePlatform: 'linkedin',
        postedAt: null,
      }));
  } catch (e: any) {
    console.error('[LinkedIn Parse] Error:', e?.message || e);
    return [];
  }
}
