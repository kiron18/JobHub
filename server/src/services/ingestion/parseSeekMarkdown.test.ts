import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock the Haiku caller so the parser test is deterministic and offline.
vi.mock('../llm', () => ({
  callClaude: vi.fn(async () => ({
    content: JSON.stringify([
      { title: 'Content Producer', company: 'VAMOS Strength Training', location: 'Mosman, Sydney NSW',
        salary: '$37.50 – $40 per hour', workMode: 'hybrid',
        sourceUrl: 'https://au.seek.com/job/92726696', teaser: 'Unique opportunity' },
    ]),
    usage: { promptTokens: 1, completionTokens: 1 },
  })),
}));

import { parseSeekMarkdown } from './parseSeekMarkdown';

describe('parseSeekMarkdown', () => {
  it('maps parsed cards to RawJob with sourcePlatform seek', async () => {
    const md = readFileSync(join(__dirname, '__fixtures__/seek-search.md'), 'utf8');
    const jobs = await parseSeekMarkdown(md);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].sourcePlatform).toBe('seek');
    expect(jobs[0].sourceUrl).toMatch(/au\.seek\.com\/job\/\d+/);
  });
});
