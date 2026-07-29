/**
 * Emphasis pass — a second look at a finished resume whose only job is to decide
 * what a hiring manager must see.
 *
 * Emphasis chosen while the resume is being written comes out following the
 * numbers rather than the relevance, because the model is busy selecting
 * content, tailoring, and managing length at the same time. The result is a
 * page where a hotel's Google rating carries the same visual weight as five
 * years of the exact experience the job asks for, and where the most relevant
 * line — "reported daily to customer stakeholders" — is never marked at all
 * because it contains no digits.
 *
 * Reading a finished document with one question in mind is a different and far
 * easier task, and it is the only point at which the whole page can be weighed
 * against the job ad at once.
 */
export const EMPHASIS_PASS_PROMPT = (
    resumeMarkdown: string,
    jobDescription: string,
    jobTitle?: string,
): string => `You are preparing a resume for a hiring manager who will look at it for about thirty seconds before deciding whether to read it properly.

Your ONLY job is to decide what their eye should land on, and mark it in bold. You are not rewriting anything.

== THE ROLE THEY ARE HIRING FOR ==
${jobTitle ? `Title: ${jobTitle}\n` : ''}"""
${jobDescription.slice(0, 6000)}
"""

== THE RESUME ==
"""
${resumeMarkdown}
"""

== HOW TO DECIDE ==
Before marking anything, work out what this particular employer is actually buying. Read the job ad for what the role genuinely requires day to day — not the boilerplate. Then ask, of each candidate line: if the hiring manager read only this, would it move them towards an interview?

Mark what answers yes. Rules, in order of importance:

1. RELEVANCE BEATS SIZE. A number is not automatically important. Emphasise the evidence that matches what this employer needs, even when the impressive figure sits somewhere else. A large number in experience unrelated to this role is a distraction — it pulls the eye away from the case you are making.

2. EMPHASIS DOES NOT HAVE TO CONTAIN A NUMBER. If the strongest proof for this job is a capability — working unsupervised in the field, reporting to customer stakeholders, holding a licence or ticket the ad asks for — mark that. This is the single biggest thing a purely numeric rule gets wrong.

3. CONCENTRATE IT WHERE THE JOB IS WON. Emphasis should cluster in the experience that sells this application. A role, project, or section that does not support this application should carry little or no emphasis, however good its numbers are. Spreading marks evenly across the page is the same as marking nothing.

4. SIX TO TEN SPANS ACROSS THE WHOLE DOCUMENT. Never more than twelve. At most ONE span per bullet. Most bullets should end up with none — that is what makes the marked ones work.

5. MARK THE PHRASE, NOT JUST THE FIGURE. Include the words that give it meaning: "cut validation cycle time by **75%, from two days to half a day**" rather than "**75%**". Keep the span inside one sentence and never let it run to the end of a long clause.

6. THE SUMMARY MAY CARRY AT MOST ONE SPAN, and only if the single most relevant thing about this candidate is stated there and nowhere else. Usually it carries none.

== WHAT YOU MAY CHANGE ==
NOTHING except the placement of ** markers.

- Return the ENTIRE document, start to finish, byte for byte identical apart from emphasis.
- Do not reword, reorder, shorten, correct, or improve a single character. Not a typo, not a date, not spacing.
- Do not add or remove lines, headings, bullets, or blank lines.
- Only "- " bullet lines and the professional summary paragraph may gain or lose emphasis.
- Leave every heading, the name line, the role line, the contact line, and every date line EXACTLY as they are — they carry no emphasis and the renderer reads their formatting structurally.
- Leave the existing "**{Degree}**" entries under Education and the "**{Label}:**" rows under Skills exactly as they are. Those are structural, not emphasis. Do not count them towards your span budget.
- You may REMOVE emphasis the previous pass added where it does not earn its place. That is expected.

Return ONLY the finished markdown document. No preamble, no explanation, no code fences.`;
