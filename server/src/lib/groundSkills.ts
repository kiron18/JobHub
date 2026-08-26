/**
 * Strip skills the resume does not support.
 *
 * The grounding gate checks employers, institutions and numbers. It has never
 * looked at the Skills section, which is where the model bake-off found every
 * hard fabrication: PostgreSQL on a candidate who has never used it, Docker and
 * GitHub on another, each one lifted from the job ad. That is the failure that
 * gets a client caught out in the first screening question, and it shipped
 * silently because nothing was watching.
 *
 * This enforces the prompt's own rule ("never import facts from the job
 * description into the candidate's history") deterministically, after the fact,
 * without spending a retry.
 */

import { normalizeForMatch, isGroundedInSource } from './fidelityGuard';

/**
 * If this much of the section would go, something is wrong with the matching
 * rather than with the resume. Keep the model's version and say so, because a
 * gutted Skills section is a worse outcome than an optimistic one.
 *
 * The count matters as well as the proportion: in a short section a single
 * genuine removal is most of it, and that is a correct removal, not a symptom.
 */
const MAX_DROP_RATIO = 0.4;
const MIN_DROPS_TO_ABSTAIN = 3;

export interface SkillFilterResult {
  content: string;
  dropped: string[];
  /** True when the safety valve fired and nothing was changed. */
  abstained: boolean;
}

/**
 * A skill counts as supported if the resume contains its words, or contains the
 * phrase with the spaces closed up. The second case is not pedantry: PDF
 * extraction routinely fuses headings to what follows ("Renewable Energy
 * SystemsISO 14001 Standards"), and a real skill must not be deleted over it.
 */
function isSupported(skill: string, normalizedResume: string, squashedResume: string): boolean {
  if (isGroundedInSource(skill, normalizedResume)) return true;
  const squashed = normalizeForMatch(skill).replace(/\s/g, '');
  return squashed.length > 2 && squashedResume.includes(squashed);
}

/**
 * Only a NAMED TOOL is ever removed.
 *
 * "PostgreSQL", "Docker", "A/B testing", "Python (in progress)" are checkable
 * claims: the resume either contains them or the candidate cannot answer for
 * them in an interview. "stakeholder communication" or "budget management" are
 * the writer characterising experience that is genuinely there, which is the
 * job, and deleting those would thin the section for nothing.
 *
 * The bias is deliberately toward leaving things in. Missing a fabrication
 * costs less than deleting something real, so a multi-word plain-English phrase
 * is always kept even when the matcher cannot find it.
 */
function looksLikeNamedTool(item: string): boolean {
  const t = item.trim();
  if (t.length < 3) return false;
  // Version numbers, .NET, C#, CI/CD, A/B, "(in progress)" qualifiers.
  if (/[0-9./#+()]/.test(t)) return true;
  // A single word is a product name far more often than it is a competency.
  return t.split(/\s+/).length === 1;
}

function splitItems(line: string): { prefix: string; items: string[] } | null {
  // "**Data & Analysis:** SQL, Python, ETL"
  const labelled = line.match(/^(\s*\*\*[^*]+:\*\*\s*)(.+)$/);
  if (labelled) return { prefix: labelled[1], items: labelled[2].split(/\s*[,;]\s*/) };
  // "- SQL, Python, ETL"
  const bullet = line.match(/^(\s*-\s+)(.+)$/);
  if (bullet && bullet[2].includes(',')) return { prefix: bullet[1], items: bullet[2].split(/\s*[,;]\s*/) };
  return null;
}

export function groundSkillsSection(markdown: string, resumeRawText: string): SkillFilterResult {
  const normalizedResume = normalizeForMatch(resumeRawText);
  const squashedResume = normalizedResume.replace(/\s/g, '');

  const blocks = markdown.split(/\n(?=## )/);
  const dropped: string[] = [];
  let seen = 0;

  const rebuilt = blocks.map((block) => {
    if (!/^## Skills/i.test(block)) return block;

    return block
      .split('\n')
      .map((line) => {
        const parsed = splitItems(line);
        if (!parsed) return line;

        const kept: string[] = [];
        for (const raw of parsed.items) {
          const item = raw.trim();
          if (!item) continue;
          seen++;
          const bare = item.replace(/\.$/, '');
          if (!looksLikeNamedTool(bare) || isSupported(bare, normalizedResume, squashedResume)) kept.push(item);
          else dropped.push(item);
        }
        // A label with nothing left under it is noise; drop the whole line.
        if (!kept.length) return null;
        return parsed.prefix + kept.join(', ');
      })
      .filter((l): l is string => l !== null)
      .join('\n');
  });

  const gutting = dropped.length >= MIN_DROPS_TO_ABSTAIN && dropped.length / seen > MAX_DROP_RATIO;
  if (!seen || gutting) {
    return { content: markdown, dropped: [], abstained: gutting };
  }
  return { content: rebuilt.join('\n'), dropped, abstained: false };
}
