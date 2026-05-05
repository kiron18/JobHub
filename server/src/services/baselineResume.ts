import { callLLM } from './llm';
import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

export async function generateBaselineResume(
  userId: string,
  resumeRawText: string,
  reportMarkdown: string,
): Promise<void> {
  try {
    const existing = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
    });
    if (existing) {
      console.log(`[BaselineResume] Already exists for userId=${userId} — skipping`);
      return;
    }

    const rules = fs.readFileSync(
      path.join(__dirname, '..', '..', 'rules', 'resume_rules.md'),
      'utf-8'
    );

    const prompt = `You are a professional Australian resume writer rewriting a candidate's resume based on a diagnostic report that identified exactly what is wrong with it.

RESUME RULES — follow every rule in this document:
${rules}

DIAGNOSTIC FINDINGS — these identify exactly what needs fixing. Address every issue directly:
${reportMarkdown}

CANDIDATE'S EXISTING RESUME:
${resumeRawText}

TASK:
Rewrite the resume above into a polished, ATS-optimised Australian resume. This is a general-purpose version (no job description) targeting the candidate's stated role.

ADDITIONAL RULES:
- Where a quantified metric is absent, insert a placeholder in this EXACT format: [Add: e.g. reduced processing time by X%]
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;

    const raw = await callLLM(prompt, false);
    const content = typeof raw === 'string' ? raw : JSON.stringify(raw);

    await prisma.document.create({
      data: {
        title: 'Your Improved Resume',
        content,
        type: 'BASELINE_RESUME',
        userId,
      },
    });

    console.log(`[BaselineResume] Generated and saved for userId=${userId}`);
  } catch (err) {
    console.error('[BaselineResume] Generation failed:', err);
    // Never throw — caller is fire-and-forget
  }
}
