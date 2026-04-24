import { describe, it, expect } from 'vitest'
import { deduplicateJobs } from '../deduplicateJobs'
import type { RawJob } from '../../services/jobFeed'

const makeJob = (overrides: Partial<RawJob> = {}): RawJob => ({
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Melbourne',
  salary: null,
  description: 'Test description for this role.',
  sourceUrl: 'https://www.seek.com.au/job/123',
  sourcePlatform: 'seek',
  postedAt: null,
  ...overrides,
})

describe('deduplicateJobs', () => {
  it('returns seek jobs unchanged when no adzuna jobs', () => {
    const seek = [
      makeJob(),
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/456', title: 'Other Job' }),
    ]
    expect(deduplicateJobs(seek, [])).toHaveLength(2)
  })

  it('returns adzuna jobs when no seek jobs', () => {
    const adzuna = [
      makeJob({ sourceUrl: 'https://www.adzuna.com.au/job/1', sourcePlatform: 'other' }),
    ]
    expect(deduplicateJobs([], adzuna)).toHaveLength(1)
  })

  it('deduplicates by exact URL — prefers seek listing', () => {
    const url = 'https://www.seek.com.au/job/123'
    const seek = [makeJob({ sourceUrl: url, description: 'Full seek description.' })]
    const adzuna = [makeJob({ sourceUrl: url, sourcePlatform: 'other', description: 'Short.' })]
    const result = deduplicateJobs(seek, adzuna)
    expect(result).toHaveLength(1)
    expect(result[0].sourcePlatform).toBe('seek')
    expect(result[0].description).toBe('Full seek description.')
  })

  it('deduplicates by fuzzy title+company+location — prefers seek', () => {
    const seek = [makeJob({ title: 'Software Engineer', company: 'Acme Corp', location: 'Melbourne' })]
    const adzuna = [makeJob({
      title: 'Software Engineer',
      company: 'Acme Corp',
      location: 'Melbourne VIC',
      sourceUrl: 'https://www.adzuna.com.au/redirect/abc',
      sourcePlatform: 'other',
    })]
    const result = deduplicateJobs(seek, adzuna)
    expect(result).toHaveLength(1)
    expect(result[0].sourcePlatform).toBe('seek')
  })

  it('keeps genuinely distinct jobs from both sources', () => {
    const seek = [makeJob({ title: 'Frontend Engineer', sourceUrl: 'https://www.seek.com.au/job/1' })]
    const adzuna = [makeJob({
      title: 'Backend Engineer',
      company: 'Different Corp',
      sourceUrl: 'https://www.adzuna.com.au/job/2',
      sourcePlatform: 'other',
    })]
    expect(deduplicateJobs(seek, adzuna)).toHaveLength(2)
  })

  it('does not produce duplicates within seek list', () => {
    const seek = [
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/1' }),
      makeJob({ sourceUrl: 'https://www.seek.com.au/job/1' }),
    ]
    expect(deduplicateJobs(seek, [])).toHaveLength(1)
  })
})
