/**
 * Video cover letter script (V1).
 *
 * The first video is GENERIC: sent to any company, for any role. So the script
 * never names a role, a job title or an employer they're applying to. Roles
 * differ in title across applications, and the lines should sell the skills
 * that meet any job description in their field.
 *
 * Line 1 is not written by the model. It's a fixed opener built from their
 * first name, and it's the one line the page lets them personalise (company,
 * role, why them) and reshoot per application.
 */
import { callLLM } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

const MAX_LINE_WORDS = 16;
const MAX_TOTAL_WORDS = 125;
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export interface VideoScript {
    firstName: string;
    /** Everything after the opener, shot once and reused for every application. */
    lines: string[];
}

export interface VideoScriptInput {
    name: string | null;
    targetCity: string | null;
    resumeRawText: string;
}

export async function writeVideoScript(p: VideoScriptInput): Promise<VideoScript> {
    const firstName = (p.name || '').trim().split(/\s+/)[0] || '[Your name]';

    const prompt = `Write the body of a short self-recorded video cover letter by an Australian job seeker. They film it on their phone and send it to recruiters and hiring managers alongside applications.

THE OPENING LINE IS ALREADY WRITTEN, do not repeat it:
"Hi, I'm ${firstName}, and this is my video cover letter for this role."
Your lines follow straight on from it.

IT MUST WORK FOR ANY APPLICATION
This is a generic video sent to many companies for roles with different titles. So:
- Never state a job title for the candidate ("I'm a social media marketer", "as a data analyst"). Describe what they have done and can do instead.
- Never name or describe the role or company they are applying to.
- Lead with skills and proof that would meet most job descriptions in their field.

HOW IT WILL BE FILMED
They film ONE LINE AT A TIME, each line a separate clip, then join the clips. Every line must be a single sentence a person can say naturally in one breath.

HARD RULES
- 6 to 8 lines, 95 to 125 words in total, so with the opener it runs under 60 seconds spoken.
- Each line 6 to 16 words. Plain spoken English, contractions welcome. No word someone would stumble on.
- Structure: a one-line snapshot of their background, two or three concrete proof points from the resume, what they bring to a team, and a short warm close that invites a chat.
- Every fact must come from the resume below. Never invent an employer, number, title, tool or outcome. If the resume has no number for something, do not produce one.
- No clichés: no "passionate", "hard-working", "team player", "go-getter", "I believe I would be a great fit", "thank you for your time".
- Australian English. No em dashes or en dashes anywhere, use commas or rewrite.

${p.targetCity ? `CITY: ${p.targetCity}\n` : ''}THE RESUME (source of every fact):
"""
${p.resumeRawText.slice(0, 8000)}
"""

Return JSON only:
{ "lines": ["<line>", "..."] }`;

    // The model drifts long, and a 25-word line can't be said in one breath.
    // One retry with the specific overrun named; after that, ship what we have.
    let lines: string[] = [];
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await callLLM(prompt + feedback, true, 0.4);
        const result = parseLLMJson(raw);
        lines = Array.isArray(result.lines)
            ? result.lines.filter((l: unknown) => typeof l === 'string' && l.trim()).map((l: string) => l.trim())
            : [];
        const long = lines.filter(l => wordCount(l) > MAX_LINE_WORDS);
        const total = lines.reduce((n, l) => n + wordCount(l), 0);
        if (lines.length && !long.length && total <= MAX_TOTAL_WORDS) break;
        feedback = `\n\nYOUR LAST ATTEMPT WAS TOO LONG (${total} words). Every line must be ${MAX_LINE_WORDS} words or fewer, ${MAX_TOTAL_WORDS} words total. Split or cut these:\n`
            + long.map(l => `- "${l}" (${wordCount(l)} words)`).join('\n');
    }
    if (!lines.length) throw new Error('Script came back empty.');
    return { firstName, lines };
}

export interface PersonalisedLines {
    role: string;
    company: string;
    /** Replaces the generic opener: the opener itself, then 1 to 2 "I read your ad" lines. */
    lines: string[];
}

export interface PersonaliseInput {
    name: string | null;
    resumeRawText: string;
    jobDescription: string;
    role?: string | null;
    company?: string | null;
    /** The master lines, so the new lines don't repeat them. */
    masterLines?: string[];
}

/**
 * The per-company swap, built on the formula from Kiron's own videos that got
 * him hired: name the role and company, then describe the job back to them in
 * your own words (or pick one line from the ad and say why it matters), tied
 * to something real from the resume. That "I read your ad" beat is what works.
 */
export async function writePersonalisedLines(p: PersonaliseInput): Promise<PersonalisedLines> {
    const firstName = (p.name || '').trim().split(/\s+/)[0] || '[Your name]';

    const prompt = `A job seeker has a generic video cover letter. They reshoot the opening to personalise it for one job. Write that personalised opening.

THE FORMULA (it's what got real interviews)
1. Name the role and the company.
2. Show they read the ad: describe what the job actually involves, in plain spoken words, OR pick one specific thing from the ad and say why it matters to them.
3. Tie it to one real thing from their resume.

WHAT TO RETURN
- "role": the job title as someone would SAY it out loud: short, no reference numbers, no locations, no sub-titles after dashes or brackets. "Business Analyst – Transformation & Change" becomes "Business Analyst".${p.role ? ` Their tracker lists it as "${p.role}".` : ''}
- "company": the employer's everyday spoken name, no "Pty Ltd", "Limited" or "Australia" suffixes. "Bolle Safety AU Pty Limited" becomes "Bolle Safety".${p.company ? ` Their tracker lists it as "${p.company}".` : ''} If the ad is from a recruiter and the employer isn't named, use the recruiter's name.
- "lines": exactly 2 lines that follow straight on from this opener, which is already written:
  "Hi, I'm ${firstName}, and this is my video cover letter for the [role] role at [company]."
  Line A covers step 2. Line B covers step 3.

HARD RULES
- Each line one sentence, 8 to 16 words, sayable in one breath. Plain spoken English, contractions welcome.
- Facts about the job come ONLY from the ad. Facts about the candidate come ONLY from the resume. Never invent either.
- Be specific to THIS ad. A line that would fit any job is a failure.
- No flattery or clichés: no "passionate", "I was excited to see", "your amazing company", "great fit", "I believe I would".
- Don't repeat anything from the rest of their video (below).
- Australian English. No em dashes or en dashes, use commas or rewrite.

THE REST OF THEIR VIDEO (don't repeat it):
${(p.masterLines || []).map(l => `- ${l}`).join('\n') || '(not provided)'}

THE JOB AD:
"""
${p.jobDescription.slice(0, 7000)}
"""

THE RESUME:
"""
${p.resumeRawText.slice(0, 6000)}
"""

Return JSON only:
{ "role": "...", "company": "...", "lines": ["<line A>", "<line B>"] }`;

    let result: any = {};
    let body: string[] = [];
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        result = parseLLMJson(await callLLM(prompt + feedback, true, 0.4));
        body = Array.isArray(result.lines)
            ? result.lines.filter((l: unknown) => typeof l === 'string' && l.trim()).map((l: string) => l.trim()).slice(0, 2)
            : [];
        const long = body.filter(l => wordCount(l) > MAX_LINE_WORDS);
        if (body.length && !long.length) break;
        feedback = `\n\nYOUR LAST ATTEMPT HAD LINES OVER ${MAX_LINE_WORDS} WORDS. Cut these down:\n`
            + long.map(l => `- "${l}" (${wordCount(l)} words)`).join('\n');
    }
    // A spoken title never carries a dash; the model occasionally keeps one.
    const spoken = (v: unknown) => String(v || '').split(/\s[–—-]\s/)[0].trim();
    const role = spoken(result.role) || spoken(p.role) || '[role]';
    const company = spoken(result.company) || spoken(p.company) || '[company]';
    if (!body.length) throw new Error('Personalised lines came back empty.');

    return {
        role,
        company,
        lines: [`Hi, I'm ${firstName}, and this is my video cover letter for the ${role} role at ${company}.`, ...body],
    };
}
