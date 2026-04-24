export interface PlatformConfig {
  label: string
  color: string
  bg: string
}

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  seek:     { label: 'Seek',      color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  indeed:   { label: 'Indeed',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  jora:     { label: 'Jora',      color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  linkedin: { label: 'LinkedIn',  color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  other:    { label: 'Job Board', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

export const APPLY_INSTRUCTIONS: Record<string, string[]> = {
  seek: [
    'Click the link above to open the job listing on Seek',
    'Log in or create a free Seek account',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
  linkedin: [
    'Click the link above to open the job on LinkedIn',
    'Sign in to your LinkedIn account',
    'Click "Apply" or "Easy Apply"',
    'Upload your resume and paste your cover letter',
    'Submit your application',
  ],
  indeed: [
    'Click the link above to open the listing on Indeed',
    'Sign in or create an Indeed account',
    'Upload your tailored resume',
    'Paste your cover letter and submit',
  ],
  jora: [
    'Click the link above — you may be redirected to the employer\'s site',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
  other: [
    'Click the link above to open the job listing',
    'Upload your tailored resume',
    'Paste your cover letter into the application form',
    'Submit your application',
  ],
}

export function getPlatformConfig(platform: string): PlatformConfig {
  return PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.other
}

export function getApplyInstructions(platform: string): string[] {
  return APPLY_INSTRUCTIONS[platform] ?? APPLY_INSTRUCTIONS.other
}

export function extractPlatformFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('seek.com.au')) return 'seek';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('jora.com')) return 'jora';
    if (host.includes('linkedin.com')) return 'linkedin';
    return 'other';
  } catch {
    return 'other';
  }
}
