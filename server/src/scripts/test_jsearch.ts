import 'dotenv/config';

async function testQuery(query: string, country?: string) {
  const key = process.env.JSEARCH_API_KEY;
  let url = `https://api.openwebninja.com/jsearch/search-v2?query=${encodeURIComponent(query)}&page=1&num_pages=1`;
  if (country) url += `&country=${country}`;

  const res = await fetch(url, { headers: { 'x-api-key': key! } });
  const data = await res.json() as { data?: { jobs?: unknown[] } };
  console.log(`\nQuery: "${query}"${country ? ` country=${country}` : ''}`);
  console.log('Jobs count:', data.data?.jobs?.length || 0);
}

async function testAll() {
  await testQuery('nurse in sydney', 'au');
  await testQuery('nurse in sydney');
  await testQuery('developer in chicago', 'us');
}

testAll().catch(console.error);
