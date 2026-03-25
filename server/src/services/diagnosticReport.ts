import { callClaude } from './llm';

export interface DiagnosticReportInput {
  targetRole: string;
  targetCity: string;
  seniority: string;
  industry: string;
  searchDuration: string;
  applicationsCount: string;
  channels: string[];
  responsePattern: string;
  perceivedBlocker: string;
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

---

CANDIDATE INTAKE DATA:
Target role: ${input.targetRole}
Target city: ${input.targetCity}
Seniority level: ${input.seniority}
Industry: ${input.industry}
Search duration: ${input.searchDuration}
Applications sent: ${input.applicationsCount}
Channels used: ${input.channels.join(', ')}
Response pattern: ${input.responsePattern}
Self-identified blocker: "${input.perceivedBlocker}"

RESUME:
"""
${input.resumeText}
"""

${coverLetterSection ? `COVER LETTERS:\n${coverLetterSection}` : 'No cover letters provided.'}

---

Write the report now. Use this EXACT structure with these EXACT markdown headings:

## Targeting Assessment

Is the role + city combination realistic given their experience? Are they too broad or too narrow? Does their resume actually reflect the roles they want? Be specific about any misalignment. Then tell them exactly how to fix it.

## Document Audit

Resume: Is it achievement-led or duty-led? Does the opening hook pass a 6-second scan? Are there quantifiable outcomes? Identify 1–2 specific improvements with exact examples.

${coverLetterSection ? 'Cover letters: Is the opening line generic or compelling? Is there a positioning narrative? Does the tone match the target industry?' : 'No cover letters were provided — note this as a gap and explain what it signals.'}

## Pipeline Diagnosis

Based on their response pattern ("${input.responsePattern}"), diagnose what stage they are dropping off and why. Be specific:
- Mostly silence → ATS/keyword/targeting problem
- Mostly rejections → fit or positioning problem
- Interviews that stall → presentation or expectation gap
- Interviews but no offers → closing, compensation, or interview technique

## The Honest Assessment

Cross-reference their self-identified blocker ("${input.perceivedBlocker}") against what their documents actually reveal. If they are right, validate it and say why. If the documents reveal a different problem, say so warmly and specifically.

## The 3-Step Fix

Three concrete, prioritised actions they can take this week. Not "improve your resume." For example: "Your resume opens with a 4-line objective. Replace it with a 2-line summary that names your speciality and your biggest proof point." Each fix should be something they can act on today.

## What JobHub Will Do For You

Close with warmth and forward momentum. Based on their specific situation, explain what the platform will help them build. Make them feel like the hard part is over and the work is about to begin.`;
}

export async function generateDiagnosticReport(input: DiagnosticReportInput): Promise<string> {
  const prompt = buildDiagnosticPrompt(input);
  const { content } = await callClaude(prompt, false);
  return content;
}
