export function buildQuestionPrompt(input: {
  achievementTitle: string;
  achievementText: string;
  jobDescription: string;
}): string {
  return `You are helping a job seeker sharpen one specific achievement on their resume so it lands harder for a specific job description.

The achievement currently lacks a measurable result. Your job is to write ONE short natural-language question that asks the user for the missing numeric / quantitative detail. The question must:
- Be specific to the achievement (not generic "add a metric")
- Ask for a CONCRETE number, scope, or timeframe the user can answer in one sentence
- Be conversational, not clinical
- Be under 25 words
- Never invent or assume a number — only ask

ACHIEVEMENT TITLE: ${input.achievementTitle}
ACHIEVEMENT TEXT: ${input.achievementText}
JOB DESCRIPTION (excerpt): ${input.jobDescription.slice(0, 800)}

Output the question and nothing else. No preamble, no labels.`;
}

export function buildParseAnswerPrompt(input: {
  question: string;
  originalText: string;
  userAnswer: string;
}): string {
  return `A job seeker just answered a question about one of their achievements. Your job is to extract the structured metric from their natural-language answer and rewrite the achievement bullet to include it.

CRITICAL RULES:
- Use ONLY numbers, scopes, and facts the user provided. Never invent.
- If the user did not provide a usable number ("I dunno", "lots", "many"), return metric: null and rewrittenText: the original text unchanged.
- The rewritten bullet must be one line, start with an action verb, and include the user's number.
- Keep the user's voice and the original achievement's intent.

QUESTION ASKED: ${input.question}
ORIGINAL ACHIEVEMENT TEXT: ${input.originalText}
USER'S ANSWER: ${input.userAnswer}

Output ONLY valid JSON in this exact shape:
{
  "metric": "<one-line metric like 'from 4k to 22k in 6 months' or null>",
  "rewrittenText": "<the rewritten bullet>"
}`;
}
