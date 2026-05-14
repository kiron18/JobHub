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

Most resumes describe what the candidate *did* — their responsibilities. What employers actually need to see is what the candidate *caused* — the outcomes. The difference between "Managed a team of 5 developers" and "Grew engineering team capacity by 40%, enabling us to ship two product lines in parallel" is the difference between a resume that looks like a job description and one that builds a picture of someone they want to hire.

Look at the resume with that lens. Is the language describing duties (what the role required) or outcomes (what this person specifically achieved)? Where does the opening hook land — does it make a recruiter stop and read, or scan past? Identify 1–2 specific examples from their actual resume text where this shift would have the biggest impact.

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

${input.perceivedBlocker
  ? `Cross-reference their self-identified blocker ("${input.perceivedBlocker}") against what their documents actually reveal. If they are right, validate it and say why. If the documents reveal a different problem, say so warmly and specifically.`
  : `Based purely on their documents, identify the single biggest thing that is costing them results. Be direct but warm. Every candidate has a primary lever — name it clearly.`
}

---

Give the immediate fix for this primary blocker. Make it feel achievable, not overwhelming.

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
