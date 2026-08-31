/**
 * The one copy of the anti-fabrication rule for the /welcome intake chain.
 *
 * On 30 Jul 2026 `diagnosticReport.ts` was found inventing figures — hours,
 * headcounts, retention rates — in the candidate's own voice, and handing them
 * to `baselineResume.ts` as literal quoted rewrites which copied them straight
 * into a resume. The cause was structural, not a bad prompt: generationV2 and
 * baselineResume each had their own anti-fabrication rules, diagnosticReport had
 * none, and nothing forced them to stay in sync.
 *
 * Every prompt in the intake chain imports this. Do not inline a paraphrase.
 */
export const EVIDENCE_RULE = `EVIDENCE RULE (absolute — overrides every other instruction in this prompt, including the voice and quality rules):

Never state a fact about this candidate that is not present in the material you have been given. This applies to numbers above all: hours, headcounts, caseloads, class or group sizes, percentages, durations, dollar amounts, outcomes, success rates, attendance or conversion figures.

You may sharpen wording. You may not add information. If a line would be stronger with a figure the candidate has not given you, you must either leave the line without the figure or ask them for it — never choose a number yourself. A figure you invented is a claim they cannot defend in an interview, and in a regulated field (health, counselling, social work, finance, engineering) it can amount to a professional misstatement made in their name.

Do not infer a figure by counting, summing, or estimating either. If their resume names the members of a team do not write "led a team of six" unless the resume itself says so. If it lists three projects do not write "delivered 3 projects". Absence of a number is not permission to derive one.`;
