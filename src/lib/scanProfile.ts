export interface ProfileIssue {
  key: string;
  label: string;
  detail: string;
}

interface ScanResult {
  issues: ProfileIssue[];
  totalCritical: number;
}

export function scanProfile(profile: any): ScanResult {
  const issues: ProfileIssue[] = [];
  const exp = profile?.experience ?? [];
  const achievements = profile?.achievements ?? [];

  // — Targeting/positioning —
  const summary = profile?.professionalSummary;
  if (!summary || String(summary).trim().length < 40) {
    issues.push({
      key: 'summary',
      label: 'No professional summary',
      detail: 'Recruiters scan the top third of your resume first. Without a summary, they decide in seconds whether to read on — and most decide "no."',
    });
  }

  const targetMissing = !profile?.targetRole || String(profile.targetRole).trim() === '';
  const hasPositioning = summary && String(summary).trim().length >= 40;
  if (targetMissing && !hasPositioning) {
    issues.push({
      key: 'targeting',
      label: 'Unclear targeting',
      detail: 'Your resume reads generally rather than for a specific role. Generic resumes compete against tailored ones — and tailored wins every time.',
    });
  }

  // — Achievement quality —
  const withMetrics = achievements.filter((a: any) => a?.metric && String(a.metric).trim());
  if (achievements.length === 0) {
    issues.push({
      key: 'achievements',
      label: 'Zero measurable achievements',
      detail: 'Your resume lists duties, not outcomes. Australian employers hire for impact — "responsible for X" doesn\'t tell them if you made a difference.',
    });
  } else if (withMetrics.length < 2) {
    issues.push({
      key: 'achievements',
      label: 'Too few quantified outcomes',
      detail: `Only ${withMetrics.length} of your ${achievements.length} achievements include a number. Unquantified claims are just claims — they don't persuade.`,
    });
  }

  // — Experience descriptions —
  if (exp.length === 0) {
    issues.push({
      key: 'experience',
      label: 'No detailed experience',
      detail: 'Volunteer work, internships, and projects all count. Without them, employers see a gap — not a candidate who made deliberate choices.',
    });
  } else {
    const thin = exp.filter((e: any) => !e?.description || String(e.description).trim().length < 30);
    if (thin.length >= Math.ceil(exp.length / 2)) {
      issues.push({
        key: 'descriptions',
        label: 'Thin role descriptions',
        detail: 'Half your roles have minimal detail. Recruiters can\'t assess what they can\'t read — and they won\'t guess.',
      });
    }
  }

  // — Skills —
  const raw = profile?.skills;
  let skillsObj: Record<string, any> | null = null;
  if (typeof raw === 'string') {
    try { skillsObj = JSON.parse(raw); } catch { skillsObj = null; }
  } else if (raw && typeof raw === 'object') {
    skillsObj = raw as Record<string, any>;
  }

  const totalSkills = skillsObj
    ? Object.values(skillsObj).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;

  if (!skillsObj || totalSkills === 0) {
    issues.push({
      key: 'skills',
      label: 'Missing skills section',
      detail: 'ATS systems scan for skills first. If yours aren\'t listed, the system doesn\'t know you have them — and flags your application as incomplete.',
    });
  }

  // Sort: summary/achievements first (most impact), cap at 3
  const priority: Record<string, number> = {
    summary: 0,
    achievements: 1,
    skills: 2,
    targeting: 3,
    experience: 4,
    descriptions: 5,
  };
  issues.sort((a, b) => (priority[a.key] ?? 99) - (priority[b.key] ?? 99));

  return {
    issues: issues.slice(0, 3),
    totalCritical: Math.min(issues.length, 3),
  };
}
