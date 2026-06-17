const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';
const FIRECRAWL_TIMEOUT_MS = 25_000; // 25s timeout for faster failure

export async function firecrawlScrape(url: string): Promise<{ markdown: string; blocked: boolean }> {
  const start = Date.now();
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');

  console.log(`[Firecrawl] Starting scrape: ${url}`);

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

    const elapsed = Date.now() - start;

    if (!res.ok) {
      console.error(`[Firecrawl] HTTP ${res.status} in ${elapsed}ms: ${await res.text().catch(() => 'unknown')}`);
      return { markdown: '', blocked: true };
    }
    const data = await res.json() as { data?: { markdown?: string } };
    const markdown: string = data?.data?.markdown ?? '';
    const blocked = !markdown || !/au\.seek\.com\/job\/\d+/.test(markdown);
    console.log(`[Firecrawl] Completed in ${elapsed}ms: blocked=${blocked}, length=${markdown.length}`);
    return { markdown, blocked };
  } catch (e: any) {
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    if (e?.name === 'AbortError') {
      console.error(`[Firecrawl] TIMEOUT after ${elapsed}ms for ${url}`);
    } else {
      console.error(`[Firecrawl] ERROR after ${elapsed}ms: ${e?.message}`);
    }
    return { markdown: '', blocked: true };
  }
}
