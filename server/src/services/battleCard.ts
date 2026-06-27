import { callClaude } from './llm';

interface BattleCardInput {
  name: string;
  email: string;
  linkedinUrl?: string | null;
  currentRole?: string | null;
  targetRole?: string | null;
  visaStatus?: string | null;
  biggestChallenge?: string | null;
  resumeText?: string | null;
  callScheduledAt?: Date | null;
}

export async function generateBattleCard(input: BattleCardInput): Promise<string> {
  const scheduledStr = input.callScheduledAt
    ? new Date(input.callScheduledAt).toLocaleString('en-AU', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney',
      })
    : 'TBC';

  const resumeSection = input.resumeText
    ? `\n\nRESUME TEXT:\n${input.resumeText.slice(0, 6000)}`
    : '\n\nRESUME TEXT: Not provided.';

  const prompt = `You are preparing Kiron (founder of Aussie Grad Careers) for a 30-minute strategy call. Generate a battle card he can scan in 60 seconds before the call starts.

CLIENT DETAILS:
Name: ${input.name}
Email: ${input.email}
LinkedIn: ${input.linkedinUrl || 'Not provided'}
Current Role: ${input.currentRole || 'Not provided'}
Target Role: ${input.targetRole || 'Not provided'}
Visa Status: ${input.visaStatus || 'Not provided'}
Biggest Challenge (in their own words): ${input.biggestChallenge || 'Not provided'}${resumeSection}

Generate the battle card in this EXACT Obsidian markdown format. Be specific and direct — this is for Kiron's eyes only. Do not pad or hedge.

---

# Call Prep — ${input.name}
*${scheduledStr} · AEST*  ·  ${input.email}${input.linkedinUrl ? `  ·  [LinkedIn](${input.linkedinUrl})` : ''}

---

## At a Glance
| Field | Detail |
|-------|--------|
| Current Role | [fill in] |
| Target Role | [fill in] |
| Visa Status | [fill in] |
| Time in Australia | [estimate from resume if available] |
| Job Search Duration | [estimate or "unknown"] |

## Background in 4 Sentences
[Write exactly 4 sentences: what they've done, where they've been stuck, what they think the problem is, and what you suspect the real problem is.]

## What Stands Out
- [3–5 specific observations — gaps, strengths, red flags, market misalignment, anything surprising]

## Questions to Open With
- [1–2 warm openers that reference something specific from their background]

## Diagnostic Questions
- [4–5 questions to identify the real blocker — not surface-level]

> [!warning] Watch Points
> - [1–2 things to navigate carefully: sensitivities, likely defensiveness, areas where they may push back]

## Recommended Close
[1–2 sentences: what to recommend at the end of the call, and how to frame it]`;

  const { content } = await callClaude(prompt, false);
  return content.trim();
}
