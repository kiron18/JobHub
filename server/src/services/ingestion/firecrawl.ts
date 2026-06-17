const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';
const FIRECRAWL_TIMEOUT_MS = 25_000; // 25s timeout for faster failure

export async function firecrawlScrape(url: string): Promise<{ markdown: string; blocked: boolean }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);

  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[Firecrawl] HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
      return { markdown: '', blocked: true };
    }
    const data = await res.json() as { data?: { markdown?: string } };
    const markdown: string = data?.data?.markdown ?? '';
    const blocked = !markdown || !/au\.seek\.com\/job\/\d+/.test(markdown);
    return { markdown, blocked };
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === 'AbortError') {
      console.error(`[Firecrawl] Timeout after ${FIRECRAWL_TIMEOUT_MS}ms for ${url}`);
    } else {
      console.error(`[Firecrawl] Error: ${e?.message}`);
    }
    return { markdown: '', blocked: true };
  }
}
