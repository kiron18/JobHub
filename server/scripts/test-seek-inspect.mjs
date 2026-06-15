/**
 * Inspect Seek's HTML structure for job cards, and check for pagination & JSON API.
 * Run: node scripts/test-seek-inspect.mjs
 */
import axios from 'axios';
import * as fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function testPage(url, label) {
  console.log(`\n========== ${label} ==========`);
  console.log(`URL: ${url}`);

  const res = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-AU,en;q=0.9',
    },
    timeout: 15000,
    maxRedirects: 0,
    validateStatus: (status) => status < 400,
  });

  const html = typeof res.data === 'string' ? res.data : '';
  console.log(`Status: ${res.status}, HTML: ${(html.length / 1024).toFixed(0)}KB`);

  // Save the HTML for inspection
  const safeLabel = label.replace(/[^a-z0-9]/gi, '_');
  fs.writeFileSync(`scripts/seek-page-${safeLabel}.html`, html);
  console.log(`Saved to scripts/seek-page-${safeLabel}.html`);

  // 1. Look for job card containers
  const cardSelectors = ['data-automation', 'class=', 'article'];
  for (const sel of cardSelectors) {
    const regex = new RegExp(`${sel}["'][^"']*job[^"']*["']`, 'gi');
    const matches = html.match(regex);
    if (matches) {
      console.log(`  "${sel}.*job" matches (first 5):`);
      matches.slice(0, 5).forEach(m => console.log(`    ${m}`));
    }
  }

  // 2. Find job titles in the HTML
  const titleMatches = html.match(/<[^>]+>[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+?<\/a>/g);
  if (titleMatches) {
    console.log(`  Possible job titles: ${titleMatches.length}`);
    titleMatches.slice(0, 8).forEach(t => console.log(`    ${t.replace(/<[^>]+>/g, '').trim()}`));
  }

  // 3. Look for pagination
  const pageLinks = html.match(/page=\d+|page\/\d+|pageNumber=\d+|pg=\d+/gi);
  if (pageLinks) {
    console.log(`  Pagination links found: ${pageLinks.slice(0, 5).join(', ')}`);
  }

  // 4. Look for a "page" or "pageSize" pattern
  const pagePattern = html.match(/["'](?:page|pageSize|totalPages|totalCount)["']\s*:\s*\d+/gi);
  if (pagePattern) {
    console.log(`  Page metadata: ${pagePattern.slice(0, 5).join(', ')}`);
  }

  // 5. Check for JSON data in script tags
  const scriptContents = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let jsonScripts = 0;
  for (const script of scriptContents) {
    if (script.includes('"jobId"') || script.includes('"jobTitle"') || script.includes('listingUrl')) {
      jsonScripts++;
      const content = script.replace(/<\/?script[^>]*>/g, '').trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        console.log(`  Found JSON-like script content (${content.length} chars)`);
        console.log(`    Preview: ${content.slice(0, 300)}`);
      }
    }
  }
  if (!jsonScripts) console.log('  No job-data JSON found in script tags');

  // 6. Look for any API endpoint pattern
  const apiCalls = html.match(/\/api\/[a-z/]+|graphql|\.seek\.com\/[a-z/]+api/gi);
  if (apiCalls) {
    const unique = [...new Set(apiCalls)];
    console.log(`  API references found: ${unique.slice(0, 8).join(', ')}`);
  }

  // 7. Look for total counts
  const countPattern = html.match(/["'](?:totalCount|totalJobCount|jobCount)["'][^}]*?\d+/gi);
  if (countPattern) {
    console.log(`  Count patterns: ${countPattern.slice(0, 3).join(', ')}`);
  }
}

async function trySeekApi() {
  console.log(`\n========== Testing Seek API endpoints ==========`);

  // Seek likely uses a GraphQL or REST API at one of these
  const endpoints = [
    'https://www.seek.com.au/api/search?keywords=laboratory+technician&location=Sydney+NSW+2000',
    'https://www.seek.com.au/graphql',
    'https://api.seek.com/v2/jobs?keywords=laboratory+technician',
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });
      console.log(`GET ${url} → ${res.status} (${(res.headers['content-type'] ?? '').split(';')[0]})`);
      if (res.status === 200 && res.headers['content-type']?.includes('json')) {
        console.log(`  Response sample: ${JSON.stringify(res.data).slice(0, 300)}`);
      }
    } catch (err) {
      console.log(`GET ${url} → Error: ${err.message}`);
    }
  }
}

async function checkPagination() {
  console.log(`\n========== Checking pagination ==========`);
  const url = 'https://au.seek.com/laboratory-technician-jobs/in-Sydney-NSW-2000?daterange=7';

  // Try page parameter variations
  const pageUrls = [
    url + '&page=2',
    url + '&pageNumber=2',
    url.replace('?', 'page/2?'),
    url + '&start=20',
    url + '&offset=20',
  ];

  for (const pageUrl of pageUrls) {
    try {
      const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': UA },
        timeout: 10000,
        validateStatus: () => true,
      });
      const html = typeof res.data === 'string' ? res.data : '';
      const countMatch = html.match(/(\d+)\s*jobs/i);
      const jobCardMatches = html.match(/data-job-id=|article.*?job|_3LJ4l/g);
      const sizeKB = (html.length / 1024).toFixed(0);
      console.log(`GET ${pageUrl.split('?daterange')[0].slice(0, 60)}...page=2 → ${res.status}, ${sizeKB}KB, jobs: ${countMatch?.[0] ?? '?'}, cards: ${jobCardMatches?.length ?? 0}`);
    } catch (err) {
      console.log(`  ${pageUrl.split('?daterange')[0].slice(0, 60)}... → Error: ${err.message}`);
    }
  }
}

async function main() {
  await testPage(
    'https://au.seek.com/laboratory-technician-jobs/in-Sydney-NSW-2000?daterange=7',
    'clean_lab_technician'
  );
  await trySeekApi();
  await checkPagination();
}

main().catch(console.error);
