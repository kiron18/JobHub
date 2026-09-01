/**
 * "It runs to three pages. Here is what I would cut."
 *
 * The page count on the welcome screen is the real one, measured off the same
 * renderer that produces the emailed PDF. That is what makes it useful and also
 * what makes it uncomfortable: it tells someone their resume is too long and
 * then leaves them to work out which part of their own career to delete.
 *
 * This closes that gap with rules, not a model. Every suggestion below is a
 * thing an Australian recruiter would say out loud, it is derived from the
 * document itself, and it quotes their own words back so the advice is
 * findable rather than abstract. No LLM call: it is instant, it is free, and it
 * cannot invent a bullet they did not write. A model pass is a later upgrade,
 * not a prerequisite.
 *
 * Nothing here edits the resume. It says where to look; the candidate cuts.
 */

export interface ResumeCut {
    /** What to do, in one line. */
    title: string;
    /** Where, in their own words, so they can find it. */
    detail: string;
}

/**
 * At roughly 95 characters to a line on the rendered page, a bullet past this
 * is three lines or more. Three-line bullets are where the length hides: they
 * read as thorough while a recruiter skims past them.
 */
const LONG_BULLET_CHARS = 190;

/** More than three suggestions stops being advice and becomes a to-do list. */
const MAX_CUTS = 3;

/** Section headings that hold a list of skills rather than prose. */
const SKILLS_HEADING = /\b(skills?|competenc|technical|tools|expertise|proficienc)\b/i;

/** Section headings that hold the work history. */
const EXPERIENCE_HEADING = /\b(experience|employment|work history|career)\b/i;

interface Bullet {
    text: string;
    section: string;
    entry: string;
}

interface ParsedResume {
    bullets: Bullet[];
    /** Entry headings (### lines) under the experience section, in document order. */
    roles: string[];
    /** How many bullets sit under each experience entry, keyed by heading. */
    bulletsPerRole: Map<string, number>;
    /** Terms found in a skills section. */
    skills: string[];
}

/** Markdown marks off, whitespace collapsed. What the reader actually sees. */
function plain(line: string): string {
    return line
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^#+\s*/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** The opening of a bullet, enough to find it on the page without quoting it whole. */
function opening(text: string, words = 8): string {
    const parts = text.split(' ');
    return parts.length <= words ? text : `${parts.slice(0, words).join(' ')}…`;
}

function parse(markdown: string): ParsedResume {
    const bullets: Bullet[] = [];
    const roles: string[] = [];
    const bulletsPerRole = new Map<string, number>();
    const skills: string[] = [];

    let section = '';
    let entry = '';

    for (const raw of (markdown || '').split('\n')) {
        const line = raw.trimEnd();

        const h2 = line.match(/^##\s+(.*)$/);
        if (h2 && !line.startsWith('###')) {
            section = plain(h2[1]);
            entry = '';
            continue;
        }

        const h3 = line.match(/^###\s+(.*)$/);
        if (h3) {
            entry = plain(h3[1]);
            if (EXPERIENCE_HEADING.test(section)) {
                roles.push(entry);
                bulletsPerRole.set(entry, 0);
            }
            continue;
        }

        const isBullet = /^\s*[-*+]\s+/.test(line);
        const text = plain(line);
        if (!text) continue;

        if (SKILLS_HEADING.test(section)) {
            // A skills block is written either as bullets or as one delimited
            // run. Both split the same way once the marker is off.
            for (const part of text.split(/[,|;•·]/)) {
                const term = part.trim();
                if (term.length >= 3 && term.length <= 40) skills.push(term);
            }
            continue;
        }

        if (!isBullet) continue;
        bullets.push({ text, section, entry });
        if (bulletsPerRole.has(entry)) bulletsPerRole.set(entry, bulletsPerRole.get(entry)! + 1);
    }

    return { bullets, roles, bulletsPerRole, skills };
}

/** Bullets long enough to be running to three lines on the page. */
function longBullets(parsed: ParsedResume): ResumeCut | null {
    const long = parsed.bullets
        .filter((b) => b.text.length > LONG_BULLET_CHARS)
        .sort((a, b) => b.text.length - a.text.length);
    if (long.length === 0) return null;

    const worst = long[0];
    const where = worst.entry ? ` under ${worst.entry}` : '';
    return {
        title: long.length === 1
            ? 'One bullet runs to three lines. Cut it to one.'
            : `${long.length} bullets run to three lines. Cut each to one.`,
        detail: `The longest${where} starts "${opening(worst.text)}". Keep the result, drop the method — a recruiter reads the first line and moves on.`,
    };
}

/**
 * The oldest role, which is the last one in the list. Australian resumes run
 * newest first, and the bottom of the history is where a two-pager is usually
 * hiding a page.
 */
function oldestRole(parsed: ParsedResume): ResumeCut | null {
    if (parsed.roles.length < 3) return null;

    const oldest = parsed.roles[parsed.roles.length - 1];
    const count = parsed.bulletsPerRole.get(oldest) ?? 0;
    if (count < 3) return null;

    return {
        title: `Your oldest role carries ${count} bullets. Two is plenty.`,
        detail: `${oldest} is the furthest from what you are applying for now. Keep the one or two lines that still say something about you today and let the rest go.`,
    };
}

/**
 * Terms sitting in the skills list that the bullets already prove. The bullet
 * is the stronger of the two every time, because it says where and to what
 * effect, so the list entry is the one to lose.
 */
function repeatedSkills(parsed: ParsedResume): ResumeCut | null {
    if (parsed.skills.length === 0 || parsed.bullets.length === 0) return null;

    const body = parsed.bullets.map((b) => b.text.toLowerCase()).join(' \n ');
    const proven = parsed.skills.filter((skill) => {
        const needle = skill.toLowerCase();
        // Two or more mentions in the bullets: once could be incidental, twice
        // means the document is making the same point in three places.
        const hits = body.split(needle).length - 1;
        return hits >= 2;
    });

    const unique = [...new Set(proven.map((s) => s.toLowerCase()))]
        .map((low) => proven.find((s) => s.toLowerCase() === low)!);
    if (unique.length === 0) return null;

    const named = unique.slice(0, 3).join(', ');
    return {
        title: unique.length === 1
            ? `"${named}" is in your skills list and proven in your bullets.`
            : `${unique.length} skills are listed and also proven in your bullets.`,
        detail: `${named} — the bullets already show where you used ${unique.length === 1 ? 'it' : 'them'} and what came of it, which is worth more than the same word in a list. Drop the list entries.`,
    };
}

/**
 * What to cut, in the order worth cutting it. Empty when the document gives no
 * honest answer — silence is better than a made-up suggestion on a screen whose
 * whole job is to be trusted.
 */
export function suggestCuts(markdown: string): ResumeCut[] {
    const parsed = parse(markdown);
    return [longBullets(parsed), oldestRole(parsed), repeatedSkills(parsed)]
        .filter((c): c is ResumeCut => c !== null)
        .slice(0, MAX_CUTS);
}
