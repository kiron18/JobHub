const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

export async function firecrawlScrape(url: string): Promise<{ markdown: string; blocked: boolean }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');
  const res = await fetch(FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  if (!res.ok) {
    console.error(`[Firecrawl] HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
    return { markdown: '', blocked: true };
  }
  const data = await res.json() as { data?: { markdown?: string } };
  const markdown: string = data?.data?.markdown ?? '';
  const blocked = !markdown || !/au\.seek\.com\/job\/\d+/.test(markdown);
  return { markdown, blocked };
}
