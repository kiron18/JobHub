import type { RawJob } from '../jobFeed';
import { callClaude } from '../llm';
import { PARSE_SEEK_PROMPT } from './prompts/parseSeekPrompt';

// Fast structured-extraction model for SEEK card parsing. Env-overridable.
const PARSE_MODEL = process.env.SEEK_PARSE_MODEL || 'anthropic/claude-haiku-4-5';

interface ParsedCard {
  title: string; company: string; location: string | null; salary: string | null;
  workMode: string | null; sourceUrl: string; teaser: string | null;
}

function canonicalUrl(url: string): string {
  const m = url.match(/au\.seek\.com\/job\/(\d+)/);
  return m ? `https://au.seek.com/job/${m[1]}` : url.split('?')[0].split('#')[0];
}

export async function parseSeekMarkdown(markdown: string): Promise<RawJob[]> {
  try {
    // Truncate to ~15k chars to stay within token limits
    const truncated = markdown.slice(0, 15000);
    const { content } = await callClaude(PARSE_SEEK_PROMPT(truncated), true, undefined, PARSE_MODEL);
    console.log(`[SEEK Parse] Response length: ${content?.length || 0}`);
    let cards: ParsedCard[];
    try {
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']');
      cards = JSON.parse(content.slice(start, end + 1));
    } catch {
      console.log('[SEEK Parse] JSON parse failed');
      return [];
    }
    console.log(`[SEEK Parse] Parsed ${cards.length} cards`);
    return cards
      .filter(c => c && c.title && c.company && c.sourceUrl)
      .map(c => ({
        title: c.title,
        company: c.company,
        location: c.location ?? '',
        salary: c.salary ?? null,
        description: c.teaser ?? '',
        sourceUrl: canonicalUrl(c.sourceUrl),
        sourcePlatform: 'seek',
        postedAt: null,
      }));
  } catch (e: any) {
    console.error('[SEEK Parse] Error:', e?.message || e);
    if (e?.response?.data) {
      console.error('[SEEK Parse] Response:', JSON.stringify(e.response.data).slice(0, 500));
    }
    return [];
  }
}
