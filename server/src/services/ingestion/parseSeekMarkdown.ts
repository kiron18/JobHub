import type { RawJob } from '../jobFeed';
import { callClaude } from '../llm';
import { PARSE_SEEK_PROMPT } from './prompts/parseSeekPrompt';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

interface ParsedCard {
  title: string; company: string; location: string | null; salary: string | null;
  workMode: string | null; sourceUrl: string; teaser: string | null;
}

function canonicalUrl(url: string): string {
  const m = url.match(/au\.seek\.com\/job\/(\d+)/);
  return m ? `https://au.seek.com/job/${m[1]}` : url.split('?')[0].split('#')[0];
}

export async function parseSeekMarkdown(markdown: string): Promise<RawJob[]> {
  const { content } = await callClaude(PARSE_SEEK_PROMPT(markdown), true, undefined, HAIKU_MODEL);
  let cards: ParsedCard[];
  try {
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    cards = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
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
}
