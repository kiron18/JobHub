import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

const RESUME_RULES = fs.readFileSync(
  path.join(__dirname, '..', '..', 'rules', 'resume_rules.md'),
  'utf-8'
);

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

    const prompt = `You are a professional Australian resume writer rewriting a candidate's resume based on a diagnostic report that identified exactly what is wrong with it.

RESUME RULES — follow every rule in this document:
${RESUME_RULES}

DIAGNOSTIC FINDINGS — these identify exactly what needs fixing. Address every issue directly:
${reportMarkdown}

CANDIDATE'S EXISTING RESUME:
${resumeRawText}

TASK:
Rewrite the resume above into a polished, ATS-optimised Australian resume. This is a general-purpose version (no job description) targeting the candidate's stated role.

ADDITIONAL RULES:
- Use only information explicitly present in the candidate's resume above. Do NOT insert placeholder text, bracketed prompts, or fill-in markers of any kind. If a metric is missing, write the bullet without it — clean, factual, action-led.
- Clean up formatting: consistent dates, proper section hierarchy, ATS-safe markdown headings, parallel bullet structure across roles.
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- The Professional Summary must be written in FIRST PERSON (e.g. "Seasoned Business Analyst with 15 years of experience…" or "I bring 10 years of…"). Never write the summary in third person — no "he", "she", "they", and never use the candidate's name within the summary itself.
- Contact line: include only the contact channels actually present in the candidate's resume above. If no LinkedIn URL is provided in their resume, OMIT LinkedIn entirely — do NOT write the word "LinkedIn" as a bare label. If a LinkedIn URL is provided, render it as the URL itself (e.g. linkedin.com/in/handle), not the word "LinkedIn".
- Markdown structure: each section header (## Professional Summary, ## Work Experience, ## Education, ## Skills, etc.) MUST be on its own line, with a blank line before and after. Never write a section header on the same line as body text. Use a single blank line between every paragraph and bullet block.
- The output is a polished draft ready for immediate use as-is. Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;

    const raw = await callLLMWithRetry(prompt, false);
    const content = typeof raw === 'string' ? raw : String(raw ?? '');
    if (!content.trim()) {
      throw new Error('LLM returned empty or non-string response');
    }

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
