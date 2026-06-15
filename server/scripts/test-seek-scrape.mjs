/**
 * Quick test: can we scrape Seek from our server?
 * Run: node scripts/test-seek-scrape.mjs
 */

import axios from 'axios';

const TESTS = [
  {
    label: 'Role-specific URL (clean)',
    url: 'https://au.seek.com/laboratory-technician-jobs/in-Sydney-NSW-2000?daterange=7',
  },
  {
    label: 'With entry-level qualifiers',
    url: 'https://au.seek.com/entry-level-graduate-junior-starter-Laboratory-Technician-jobs/in-Sydney-NSW-2000?daterange=7',
  },
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

async function run() {
  for (const test of TESTS) {
    const ua = USER_AGENTS[0];
    console.log(`\n========== ${test.label} ==========`);
    console.log(`URL: ${test.url}`);

    try {
      const res = await axios.get(test.url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        timeout: 15000,
        // Don't follow redirects — we want to see if Seek redirects to a block page
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 302 || status === 301 || status === 403,
      });

      console.log(`Status: ${res.status}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Length: ${res.headers['content-length'] ?? '(not set)'}`);

      if (res.status === 403) {
        console.log('❌ Blocked (403) — Seek is rejecting the request');
        console.log(`Body preview: ${(res.data ?? '').slice(0, 500)}`);
        continue;
      }

      const html = typeof res.data === 'string' ? res.data : '';

      // Count job-related content
      const jobCardMatches = html.match(/data-job-id=|article.*?job|_3LJ4l|_2i2jM|data-automation/g);
      console.log(`Job-card markers found: ${jobCardMatches?.length ?? 0}`);

      // Check for job count text
      const countMatch = html.match(/(\d+)\s*jobs/i);
      if (countMatch) console.log(`Job count text: "${countMatch[0]}"`);

      // Look for the seek API data embedded in the page
      const jsonData = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
      if (jsonData) {
        console.log('✅ Found window.__INITIAL_STATE__ (has embedded JSON data)');
        console.log(`JSON data length: ${jsonData[1].length} chars`);
      } else {
        console.log('No window.__INITIAL_STATE__ found');
      }

      // Check for any script tags that look like data payloads
      const scriptData = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      if (scriptData) {
        console.log('✅ Found __NEXT_DATA__ (Next.js SSR data)');
      } else {
        console.log('No __NEXT_DATA__ found');
      }

      console.log(`HTML length: ${html.length} bytes`);
      console.log(`HTML preview (first 300 chars):`);
      console.log(html.slice(0, 300));
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      if (err.response) {
        console.log(`Status: ${err.response.status}`);
        console.log(`Headers:`, JSON.stringify(err.response.headers, null, 2));
      }
    }
  }
}

run().catch(console.error);
