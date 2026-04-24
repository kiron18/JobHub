import type { RawJob } from '../services/jobFeed'

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function isSimilar(a: string, b: string): boolean {
  const na = normalise(a), nb = normalise(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return true
  return levenshtein(na, nb) / maxLen <= 0.15
}

function jobSignature(job: RawJob): string {
  return normalise(`${job.title} ${job.company} ${job.location ?? ''}`)
}

/** Merges seek (preferred) and adzuna jobs, deduplicating by URL then by fuzzy title+company+location. */
export function deduplicateJobs(seekJobs: RawJob[], adzunaJobs: RawJob[]): RawJob[] {
  const urlSet = new Set<string>()
  const result: RawJob[] = []

  for (const job of seekJobs) {
    if (job.sourceUrl && urlSet.has(job.sourceUrl)) continue
    if (job.sourceUrl) urlSet.add(job.sourceUrl)
    result.push(job)
  }

  for (const job of adzunaJobs) {
    if (job.sourceUrl && urlSet.has(job.sourceUrl)) continue
    const sig = jobSignature(job)
    if (result.some(s => isSimilar(sig, jobSignature(s)))) continue
    if (job.sourceUrl) urlSet.add(job.sourceUrl)
    result.push(job)
  }

  return result
}
