export interface ExperienceLike {
  role: string;
  company: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
}

export interface ExperienceFlag {
  index: number;        // index into the experience array this flag describes
  relevant: boolean;    // relevant to the target job → feature it in full
  australianLocal: boolean; // performed in Australia → worth a one-line mention if irrelevant
}

export interface SelectionResult<T extends ExperienceLike> {
  featured: T[];
  additionalExperienceLine: string | null;
}

// Pull a 4-digit year from a loose date string ("2024-06", "Feb 2024", "2024").
function yearOf(s: string | null | undefined): number | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Apply per-experience relevance/locality flags to a candidate's experience list.
 *  - relevant            → featured (rendered in full)
 *  - irrelevant + local  → folded into a single "Additional Australian experience" line
 *  - irrelevant + !local → dropped
 * Fallback: if flags are null or do not align 1:1 with the experience list, keep ALL
 * experience as featured (today's behaviour) so this can never produce a worse resume.
 */
export function selectFeaturedExperience<T extends ExperienceLike>(
  experience: T[],
  flags: ExperienceFlag[] | null | undefined,
): SelectionResult<T> {
  const valid = Array.isArray(flags) && flags.length === experience.length;
  if (!valid) {
    return { featured: [...experience], additionalExperienceLine: null };
  }

  const flagByIndex = new Map(flags!.map(f => [f.index, f]));
  const featured: T[] = [];
  const localIrrelevant: T[] = [];

  experience.forEach((e, i) => {
    const f = flagByIndex.get(i);
    if (!f || f.relevant) { featured.push(e); return; }     // unflagged → keep (safe)
    if (f.australianLocal) { localIrrelevant.push(e); return; }
    // irrelevant + non-local → drop (do nothing)
  });

  let additionalExperienceLine: string | null = null;
  if (localIrrelevant.length > 0) {
    const seen = new Set<string>();
    const roles: string[] = [];
    for (const e of localIrrelevant) {
      const role = (e.role || '').trim();
      const key = role.toLowerCase();
      if (!role || seen.has(key)) continue;
      seen.add(key);
      roles.push(role);
    }
    const shownRoles = roles.length > 5 ? [...roles.slice(0, 5), 'and more'] : roles;

    const years: number[] = [];
    for (const e of localIrrelevant) {
      const y1 = yearOf(e.startDate);
      const y2 = yearOf(e.endDate);
      if (y1 !== null) years.push(y1);
      if (y2 !== null) years.push(y2);
    }
    let range = '';
    if (years.length > 0) {
      const min = Math.min(...years);
      const max = Math.max(...years);
      range = min === max ? ` (${min})` : ` (${min}–${max})`;
    }

    additionalExperienceLine = `**Additional Australian experience:** ${shownRoles.join(', ')}${range}`;
  }

  return { featured, additionalExperienceLine };
}
