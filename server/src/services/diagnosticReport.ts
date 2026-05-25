import { callClaude } from './llm';

export interface DiagnosticReportInput {
  targetRole: string;
  targetCity?: string;
  seniority: string;
  industry: string;
  searchDuration?: string;
  applicationsCount?: string;
  channels?: string[];
  responsePattern: string;
  perceivedBlocker?: string;
  resumeText: string;
  coverLetterText1?: string;
  coverLetterText2?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC PROMPT v1
// This is the only place the diagnostic prompt lives. To iterate: edit here
// only. No other files need to change.
// Emotional arc: recognition → relief → excitement.
// Rule: every identified problem is IMMEDIATELY followed by a fix.
// Rule: never use language that implies a character flaw. "Duty-led" not "weak".
// ─────────────────────────────────────────────────────────────────────────────
function buildDiagnosticPrompt(input: DiagnosticReportInput): string {
  const coverLetterSection = [
    input.coverLetterText1 ? `Cover Letter 1:\n"""\n${input.coverLetterText1}\n"""` : '',
    input.coverLetterText2 ? `Cover Letter 2:\n"""\n${input.coverLetterText2}\n"""` : '',
  ].filter(Boolean).join('\n\n');

  return `You are a senior career strategist conducting a personalised job search diagnosis for a candidate.

Your output is a structured markdown report with exactly 6 sections. Each section must be honest, specific, and warm. Every problem you identify must be immediately followed by a concrete fix. The emotional arc the candidate should feel reading this report is: recognition → relief → excitement. Never imply a character flaw. "Duty-led resume" is fine. "Weak resume" is not.

PROSE FORMATTING RULE: Write in short paragraphs of 3–4 lines maximum. After every 3–4 lines of prose, insert a blank line and start a new paragraph. Never write a block of text longer than 4 lines without a paragraph break. This applies everywhere in the report.

DIAGNOSIS VOICE — applies to every section EXCEPT "The 3-Step Fix" and "What JobHub Will Do For You":

You are not coaching, comforting, or framing. You are surfacing what the candidate has been doing for months without seeing it. The reader's first reaction to any diagnosis sentence should be "I have been doing this for months and could not see it." If their reaction would be "yes, I already knew that," the sentence has failed and you must rewrite it.

The "couldn't have written it themselves" test: if the candidate could have produced your sentence by reading their own resume back to themselves, you have failed. You must surface a causal link they did not see — not a mismatch they already knew about. Specific behaviour they did mechanically + the mechanism by which it is costing them, in their reality.

Three hard bans inside any diagnosis sentence:
1. No mid-sentence reframes or rescue moves. Never write "that's actually a strength", "that's not a weakness, it's a specialism", "the good news is", "the real story is", "it's not about X, it's about Y" as a rescue. Once you name the cost, do not soften it in the same breath. The reframe gives the reader an exit ramp; close every exit ramp inside the diagnosis.
2. No compliments before the diagnosis. Never open a diagnosis sentence with what they did right. Save validation for the fix sections.
3. No abstract costs. "Recruiters can't see themselves in your experience" is abstract — the candidate has nothing concrete to react to. "And that is why your callback rate is closer to 1% than 5% on 100 applications" is concrete. Always name the cost in their reality: silence, ghosting, auto-filter, scroll-past, six-second scan, callback rate, dead months, the recruiter never stopping on their name.

The warmth is in being on their side and being right about a thing they could not see alone. It is not in softening the truth. A doctor reading a scan does not flatter the scan.

---

CANDIDATE INTAKE DATA:
Target role: ${input.targetRole}${input.targetCity ? `\nTarget city: ${input.targetCity}` : ''}
Seniority level: ${input.seniority}
Industry: ${input.industry}${input.searchDuration ? `\nSearch duration: ${input.searchDuration}` : ''}${input.applicationsCount ? `\nApplications sent: ${input.applicationsCount}` : ''}${input.channels?.length ? `\nChannels used: ${input.channels.join(', ')}` : ''}
Response pattern: ${input.responsePattern}${input.perceivedBlocker ? `\nSelf-identified blocker: "${input.perceivedBlocker}"` : ''}

RESUME:
"""
${input.resumeText}
"""

${coverLetterSection ? `COVER LETTERS:\n${coverLetterSection}` : 'No cover letters provided.'}

---

Write the report now. Use this EXACT structure with these EXACT markdown headings.

CRITICAL FORMAT RULE: Within each section, write the diagnosis/problem first, then a line containing only "---", then the fix/action. This separator is mandatory in every section so the candidate sees what is wrong AND what to do about it as distinct parts.

Example structure for every section:
## Section Heading
[diagnosis — what is happening and why it is costing them results]

---

[concrete fix — what to do, specific and actionable]

## Targeting Assessment

Is the role + city combination realistic given their experience? Are they too broad or too narrow? Does their resume actually reflect the roles they want? Be specific about any misalignment.

---

Tell them exactly how to fix it. Specific role titles, seniority level, or positioning shift they should make.

## Document Audit

Most resumes describe what the candidate did, their responsibilities. What employers actually need to see is what the candidate caused, the outcomes. State the principle as a one-line formula the candidate can re-use on every bullet:

**Formula = What you did + What outcome was achieved as a result.**

Choose ONE illustrative before/after example from a field DIFFERENT to the candidate's stated industry "${input.industry}", so the pattern is shown rather than mirrored. Pick from this rotating set, picking the first one whose field is not the candidate's:
- Engineering: "Managed a team of 5 developers" → "Led a 5-person engineering team to ship 3 product features in Q2, cutting time-to-market by 30%."
- Finance: "Reviewed monthly accounts" → "Reviewed monthly accounts across 12 cost centres and surfaced $180K of misallocated spend in the first quarter."
- Design: "Designed marketing collateral" → "Redesigned the onboarding flow, lifting trial-to-paid conversion from 18% to 27% over 8 weeks."
- Operations: "Coordinated logistics" → "Coordinated logistics across 4 sites and cut average delivery time from 5.2 to 3.4 days."

Look at the candidate's resume with the formula lens. Is the language describing duties or outcomes? Where does the opening hook land, does it make a recruiter stop and read, or scan past? Identify 1 to 2 specific lines from their ACTUAL resume text where applying the formula would have the biggest impact.

${coverLetterSection ? 'Cover letters: Does the opening line start with the candidate or with the role? A line that opens with "I am applying for..." signals a transactional mindset. A line that opens with a specific insight about the company or a direct value statement signals someone who did the work. Evaluate whether the cover letter positions them or just summarises the resume.' : 'No cover letters were provided — note this as a gap. Recruiters at competitive firms use the cover letter to filter for written communication, motivation, and cultural fit. Not having one means leaving that round unplayed.'}

---

Give 1–2 specific, actionable rewrites they can apply today. Use blockquote format for before/after comparisons like this:
> Before: "Managed a team of 5 developers"
> After: "Led 5-person engineering team to ship 3 product features in Q2, reducing time-to-market by 30%"

Quote their actual resume text, then show the improved version. Make the rewrite feel achievable — one specific change, not an overhaul.

## Pipeline Diagnosis

Based on their response pattern ("${input.responsePattern}"), diagnose what stage they are dropping off and why. Be specific:
- Mostly silence → ATS/keyword/targeting problem
- Mostly rejections → fit or positioning problem
- Interviews that stall → presentation or expectation gap
- Interviews but no offers → closing, compensation, or interview technique

---

Name exactly what to change and how. One concrete action per diagnosed problem.

## The Honest Assessment

Apply all DIAGNOSIS VOICE rules above. This section is the longer, slightly less compressed version of what the Headline Insight will distil into one sentence — the two must agree on the same primary blocker.

${input.perceivedBlocker
  ? `Cross-reference their self-identified blocker ("${input.perceivedBlocker}") against what their documents actually reveal. If their self-diagnosis is right, validate it by naming the specific evidence in their file that confirms it AND the concrete cost. If the documents reveal a different problem, say so and name the actual blocker with the same specificity — do not soften the correction with "but you were close" or "the good news is". Be on their side by being right, not by being gentle.`
  : `Based purely on their documents, identify the single biggest thing that is costing them results. Name a specific behaviour visible in their file plus the concrete mechanism by which it is producing the silence / ghosting / scroll-past they are experiencing. No abstract harm. No reframes mid-paragraph.`
}

Two to four short paragraphs. Quote at least one specific phrase, bullet, or choice from their actual file so they cannot dismiss the diagnosis as generic. End on the cost in concrete terms (silence, callback rate, dead months) — do not end on a softener.

---

Give the immediate fix for this primary blocker. Voice shifts here: calm-ally, achievable, specific. The diagnosis above earned the right to be hard; the fix below earns the right to be warm.

## Headline Insight

Write ONE sentence — and only one. Maximum 32 words. This is the very first thing the candidate will read above the fold. It must compress the primary blocker you just named in The Honest Assessment into a single freight-train mirror-back that produces an "I have been doing this for months and could not see it" reaction in the candidate's first read.

Apply all DIAGNOSIS VOICE rules above (no reframes, no compliments-before-diagnosis, no abstract costs, must pass the "couldn't have written it themselves" test). Additional constraints specific to this sentence:

- Exactly ONE sentence. No bullets. No "---" separator. No preamble. No closing line. No semicolons. Two short clauses joined by a comma is acceptable. Three clauses is not.
- Maximum 32 words. If you exceed 32 words you have failed and must rewrite shorter.
- It must quote or paraphrase ONE specific choice in their intake OR one specific pattern in their resume that a stranger reading their file would not have known to mention. The candidate must feel "they saw THAT" in the first 12 words.
- Pair that observation with the concrete cost — the mechanism in their reality. "...and that is why the silence", "...is why a six-second recruiter scan never stops on your name", "...is why your callback rate sits closer to 1% than 5%". The cost half is non-negotiable.
- Never open with "You're aiming for...", "You have a...", "Your resume is..." as a recap of what they already told us. Reveal, do not summarise.
- ABSOLUTELY FORBIDDEN inside this sentence (zero tolerance — any of these means rewrite from scratch): "that's not a weakness", "that's actually", "it's a specialism", "it's actually a strength", "the good news is", "the real story is", "but actually", "let's start by acknowledging". These are rescue moves that hand the reader an exit ramp. Close every exit ramp.
- Never open with a compliment, never with reassurance.
- Headline and Honest Assessment must point at the SAME primary blocker. They are the same idea at different compression levels.

Voice check: a doctor reading a scan, not a drill sergeant. No exclamation marks. No "brutal". No "killing". No "crushing". No shouting. The sentence should land because it is true and specific, not because it is loud. The candidate's spine straightens because someone finally named a thing they had been doing without seeing.

Style examples (for tone, do not copy verbatim):
> You ticked "any industry" while every line of your resume is unambiguously B2B-events marketing, and that mismatch is the silence on the last 100 applications.
> Your resume lists fourteen responsibilities and zero outcomes, which is why a recruiter's six-second scan never stops on your name.
> You have called this a volume problem after 200 applications, but your callback rate says it is a positioning problem you have been amplifying, not solving.

Anti-examples (do not produce sentences like these, or anything close):
> You're aiming for mid-level marketing roles in Sydney, that's actually smart positioning. (compliment-as-opener; no diagnosis)
> Your resume is structurally sound, but there are opportunities to sharpen it. (vague; no specific behaviour, no concrete cost)
> Let's start by acknowledging the work you have already put in. (validation-as-opener; no diagnosis)
> You've said "any industry" but your resume tells a very specific story: B2B events marketing, community building, and marketing automation. That's not a weakness, it's a specialism. But when you cast wide while your evidence points narrow, recruiters in retail, FMCG, or SaaS can't see themselves in your experience.

The fourth anti-example is the most important one to study. It fails in three ways at once: (1) three sentences when the rule was one, (2) contains the forbidden rescue "that's not a weakness, it's a specialism" which hands the reader an exit ramp mid-paragraph, (3) the cost is abstract ("can't see themselves in your experience") rather than concrete (silence, callback rate, dead months). The candidate could have written that paragraph themselves by reading their own file, so it produces zero "oh, I could not see this" recognition. It is the failure mode you must not reproduce.

Emit exactly one sentence in this section. Nothing else.

## The 3-Step Fix

Voice rules for this section: calm, plain, calm-ally tone. Use "you" not "the candidate" in the rendered text. No em dashes. No exclamations. Avoid the words: brutal, killing, crushing, rocket, fire, "stop guessing", "stop getting rejected". Be brief. Be specific to THIS candidate. No selling.

Emit three moves in EXACTLY this format. Each move is one short imperative ACTION sentence the candidate can act on TODAY to make their job search materially better. Aim for 12 to 22 words. Crisp, executable, not a paragraph, not a description.

CRITICAL: Use plain text labels. Do NOT wrap labels in markdown bold. Write "ACTION:" as plain text, never "**ACTION:**". Do not add any other prose between or around the moves.

### MOVE_TARGETING
ACTION: <one crisp imperative sentence on sharpening role targeting today. Specific to THIS candidate. Plain prose, no markdown, no bullets.>

### MOVE_RESUME
ACTION: <one crisp imperative sentence on refining their resume framing or structure today. Specific to THIS candidate. Plain prose.>

### MOVE_APPLICATIONS
ACTION: <one crisp imperative sentence on tightening how they apply (volume vs quality, channels, follow-up) today. Specific to THIS candidate. Plain prose.>

## What JobHub Will Do For You

Close with warmth and forward momentum. Based on their specific situation, explain what the platform will help them build. Make them feel like the hard part is over and the work is about to begin.`;
}

export async function generateDiagnosticReport(input: DiagnosticReportInput): Promise<string> {
  const prompt = buildDiagnosticPrompt(input);
  const { content } = await callClaude(prompt, false);
  return content;
}

// Test-only export. Allows the prompt assembler to be exercised directly
// without an LLM call.
export const buildDiagnosticPromptForTest = buildDiagnosticPrompt;
