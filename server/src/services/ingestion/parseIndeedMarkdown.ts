import type { RawJob } from '../jobFeed';
import { callClaude } from '../llm';
import { PARSE_INDEED_PROMPT } from './prompts/parseIndeedPrompt';

// Fast structured-extraction model for card parsing. Env-overridable; matches SEEK.
const PARSE_MODEL = process.env.SEEK_PARSE_MODEL || 'anthropic/claude-haiku-4-5';

interface ParsedCard {
  title: string; company: string; location: string | null; salary: string | null;
  sourceUrl: string; teaser: string | null;
}

// Indeed job links carry the job key in the query string (?jk=...), so keep the
// query and only strip the fragment.
function canonicalUrl(url: string): string {
  return url.split('#')[0];
}

export async function parseIndeedMarkdown(markdown: string): Promise<RawJob[]> {
  try {
    // Truncate to ~15k chars to stay within token limits
    const truncated = markdown.slice(0, 15000);
    const { content } = await callClaude(PARSE_INDEED_PROMPT(truncated), true, undefined, PARSE_MODEL);
    console.log(`[Indeed Parse] Response length: ${content?.length || 0}`);
    let cards: ParsedCard[];
    try {
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']');
      cards = JSON.parse(content.slice(start, end + 1));
    } catch {
      console.log('[Indeed Parse] JSON parse failed');
      return [];
    }
    console.log(`[Indeed Parse] Parsed ${cards.length} cards`);
    return cards
      .filter(c => c && c.title && c.company && c.sourceUrl)
      .map(c => ({
        title: c.title,
        company: c.company,
        location: c.location ?? '',
        salary: c.salary ?? null,
        description: c.teaser ?? '',
        sourceUrl: canonicalUrl(c.sourceUrl),
        sourcePlatform: 'indeed',
        postedAt: null,
      }));
  } catch (e: any) {
    console.error('[Indeed Parse] Error:', e?.message || e);
    return [];
  }
}
