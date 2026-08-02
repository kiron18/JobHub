# JobHub — Will This Consistently Produce a Good Australian Resume?

Evaluation of the **live path only** (`generationV2.ts` → shape check → `checkGrounding` → `checkStyle` → retry → emphasis pass). The orphaned engine is excluded because it never runs. See `PROMPT-SURFACE-MAP.md`.

Judged as a career coach against current Australian market convention, not against other AI tools.

---

## Verdict

**High ceiling. Unreliable floor. Not yet consistent.**

On a good run this produces a resume better than what most Australian candidates write themselves and better than what most commercial AI resume tools produce. The honesty discipline and the emphasis logic are genuinely above market.

But "consistently good" is a different claim, and it fails that one — because the three things that determine consistency are all unconstrained:

| Determinant | Current state |
|---|---|
| **Input quality** | The unfixed original upload. The cleaned baseline exists and is discarded. |
| **Document structure** | The model chooses section order per run. |
| **Length** | Two instructions in direct conflict; the wrong one has teeth. |

Nothing in the pipeline governs any of the three. So output quality tracks input quality, and varies run to run on identical inputs. A client with a tidy resume gets an excellent document. A client with a messy one gets a tidied-up mess — which is the majority of your ICP, because a messy resume is why they bought.

**Estimate: roughly 6 in 10 outputs are send-ready. 3 need an edit a client won't know to make. 1 has a structural problem that costs them the read.** That's not bad for an automated system. It is not what you're charging for.

---

## What is genuinely above market — protect this

**1. The anti-fabrication architecture.** `generationV2.ts:10-18` — every employer, title, date, qualification, number must appear in the source; never invent, estimate, round, or extrapolate; never import JD facts into the candidate's history; never use outside knowledge about a company. This is the failure mode that destroys candidates in interviews and almost every competitor ships it broken. You took it seriously.

**2. It's enforced in code, not just asked for.** `checkGrounding` deterministically verifies numbers, employer names, institutions, email and phone against the source. Most tools have the prompt rule and no gate. You have both. (Caveats below — it leaks — but the architecture is right.)

**3. The emphasis pass is the best thing in the codebase.** `emphasisPass.ts` is a genuinely sophisticated piece of coaching translated into a prompt: relevance beats size; emphasis does not have to contain a number; a large figure in unrelated experience is a *distraction*; concentrate marks where the job is won; spreading them evenly is the same as marking nothing. Then `verifyEmphasisPass` confirms the model changed nothing but bold, with a deterministic `boldMetricsInMarkdown` fallback if it drifted. That is careful engineering around a subtle judgement, and the reasoning in the file header — that emphasis chosen *while* writing follows digits rather than relevance — is a real insight.

**4. Never bold a skill, tool, company, title or date** (`generationV2.ts:75`). Correct, non-obvious, and one of the fastest tells of a machine-written resume.

**5. Completeness over deletion.** "Never fit the budget by deleting an entry or a section" (`:27`). Right for Australia, where an unexplained date gap gets asked about.

**6. Australian English is enforced everywhere,** including in the orphaned files. Consistent discipline.

---

## Against current Australian market convention

Durable conventions, not a 2026 fad — these have been stable for years and the live prompt is silent on most of them.

| Convention | Handled? | Where |
|---|---|---|
| Reverse chronological | ⚠️ | Enforced for Work Experience only; other dated sections unconstrained |
| 2 pages max | ❌ | "Aim for 2 A4 pages" is overridden by the completeness rule |
| No photo / DOB / marital status / nationality | ❌ | **Nothing on the live path.** See below. |
| Suburb + state only, no street address | ❌ | Contact rule reproduces whatever's in the source |
| Australian English | ✅ | `:46` |
| Achievements over duties | ✅ | `:39` — strong |
| ATS-safe structure (no tables/columns/text boxes) | ✅ | Markdown output makes this structurally impossible to get wrong |
| Standard section headings | ✅ | Shape check enforces four of them |
| LinkedIn URL in contact line | ✅ | `:28` |
| Skills section present | ✅ | Shape check requires it |
| Tailored per application | ✅ | This is the core of the product |
| Work rights / visa statement | ❌ | **Nothing on the live path.** See below. |
| Referees convention | ⚠️ | "Available upon request" — fine, mildly dated, harmless |

### The two gaps that actually cost your clients interviews

**Photo, date of birth, marital status, nationality.** Candidates from India, Pakistan, Bangladesh, the Middle East and parts of Europe include these as standard because it *is* standard at home. In Australia it reads as unfamiliarity with the market, and it creates a discrimination-exposure problem that makes some recruiters discard the application rather than manage the risk. The live prompt's completeness rule — "every category of content in the source resume must appear in your output" — means **if the candidate uploaded a resume with a photo reference, DOB and marital status, the system is instructed to preserve them.** That is actively harmful for your exact ICP, and it's a direct consequence of a rule that's otherwise correct.

**Work rights.** For international graduates and skilled migrants, unstated work rights is often the silent screen-out — the recruiter assumes sponsorship is needed and moves on. A single line ("Full working rights, subject class 485 valid to [date]") converts a guess into a fact. The dead `cover_letter_rules.md` handles visa placement thoughtfully (§0 rule 7, closing paragraph only, one confident sentence). The live resume prompt says nothing at all.

Both belong at **intake**, not generation — they're properties of the person, decided once.

---

## The consistency problem, in detail

### 1. Section order is model-chosen, every run

`generationV2.ts:61` — "All other sections mirror the source resume's own content… placed in the order that best serves this application."

Only Summary, Work Experience, Education and Skills are pinned by the shape check, and the check only tests *presence*, not order:

```ts
text.includes('## Professional Summary'), text.includes('## Work Experience'), ...
```

So Projects, Certifications, Volunteering and Referees float, and there is no guarantee the four required sections appear in the intended sequence at all. This is why Khushal's skills block landed at the bottom — not a rule, a per-run decision. Two clients in the same field can get different documents, and neither you nor they can see why.

### 2. Length is governed by contradictory instructions

"Aim for 2 A4 pages" (`:45`) versus "never fit the budget by deleting an entry or a section" (`:27`), the latter marked *equal priority to honesty*. For a career changer with ten roles these cannot both hold. The rule with teeth wins, so long histories produce three-page resumes.

The orphaned Gen-2 prompt solved this correctly (`resumeStructuredPrompt.ts:118`): hard total budget, 3–4 bullets for the most relevant roles, 1–2 for the rest, "roughly 10 to 14 bullets in total, never more." That intelligence existed and was lost in the migration.

The page estimate at `generate.ts:790` (`nonEmptyLines / 45`) is computed, returned to the client as `estimatedPages` — and never acted on. Nothing rejects or shortens a 3-page resume.

### 3. Input quality is unconstrained

Covered fully in the map file: `generateBaselineResume` produces a cleaned resume using the good doctrine and the diagnostic, saves it as a downloadable Document, and generation then reads `resumeRawText` — the original upload. Garbage-in is structurally permanent.

This is the dominant term. Fixing structure and length while still generating from a messy original is polishing the wrong artifact.

---

## The grounding gate: real, but leakier than it looks

I ported the exact logic from `groundingGate.ts` and ran fabricated figures against Khushal's actual resume text (4,757 chars normalised).

The number check normalises the source by stripping all punctuation *and all whitespace*, then asks whether the figure appears as a **substring**. A resume's phone number, postcodes and years supply most two-digit combinations for free.

Result on real data — fabricated figures the gate **accepts as grounded**:

```
85%  ✗ passes      30%  ✗ passes      25%  ✗ passes
40%  ✗ passes      18%  ✗ passes      $775 ✗ passes
```

Caught: `45% 60% 12% $50,000 200+ 150 99% 72%`. So roughly half the fabricated figures I tested pass. **And leakage scales with resume length** — a longer source contains more digit substrings, so a three-page senior resume approaches no filtering at all.

Two harder holes:

**Single-digit numbers are never checked.** `extractNumbers` requires `\d{2,}` for bare numbers, so "led a team of 8", "managed 3 direct reports", "across 5 sites" are entirely ungated. That's a large and common class of resume claim.

**Numbers from the job ad count as grounded.** `groundingGate.ts:149-151`:

```ts
if (!inResume && !inJobDesc) { violations.push(...) }
```

A job ad saying "managing a portfolio of 200+ clients" makes "200" a legal figure in the candidate's history. **The prompt explicitly forbids exactly this** (`generationV2.ts:17`: "Never import facts from the job description into the candidate's history") — the gate permits what the prompt bans. This is the most serious correctness issue on the live path, and it's the one that could put a client in front of an interviewer defending a number they never earned.

None of this makes the gate worthless — it reliably catches invented employers, institutions and contact details, which are the highest-consequence fabrications. But it should not be described internally as an honesty guarantee.

---

## Cover letter

Shorter judgement, because the ceiling is lower and the problems are simpler.

- **400–500 words is too long for this market.** `generationV2.ts:110` actively pushes toward the ceiling ("a letter under 400 words is too short"). 250–350 is the sweet spot. Your own dead doctrine had this right, and its 218-word worked example is better than what the live prompt will produce.
- **The close is unspecified.** "Close briefly and confidently, inviting a conversation" is all the live prompt says. The approved patterns and the banned passive closes sit in the dead file, and `styleLint` enforces neither. Expect "I look forward to hearing from you" to ship regularly.
- **"Dear Hiring Manager" is the default** with no nudge to find a name. The dead doctrine treated that as a missed opportunity worth a phone call. Real coaching value, gone.
- **No company-research requirement.** The live prompt confines company facts to the JD — safer than hallucinating, but for a thin ad it guarantees a letter about the role rather than the employer, which is the generic shape.
- **The shape check is two `includes` calls** — a salutation and "Yours sincerely,". Paragraph count, structure and CTA are unverified.

Worth naming plainly: **a 450-word, 4–5 paragraph, competently-written letter is now a recognisable AI shape.** Recruiters have been reading them for two years. The anti-cliché rules are well-aimed at this, but length and uniformity work against them. A 260-word letter that says one specific thing reads more human than a 470-word one that says four general things.

---

## What would make it consistent

In leverage order. The first three are close to riskless and don't change how documents are written.

1. **Wire the baseline into generation.** Dominant term. Everything else is downstream of input quality.
2. **Pin the section order** in `RESUME_V2_PROMPT` and extend the shape check to verify sequence, not just presence. Kills the variance you spotted.
3. **Cover letter length → 250–380** in the prompt, the linter, and the three tests.
4. **Port Gen-2's bullet budget** into the live prompt to resolve the length contradiction. Then act on `estimatedPages` instead of just returning it.
5. **Fix the grounding gate's two holes:** drop `inJobDesc` from the numbers check, and lower the bare-number threshold to `\d{1,}`. Expect a higher violation rate and more retries — that's the gate doing its job for the first time.
6. **Add the intake rules your ICP needs:** strip photo/DOB/marital status/nationality; suburb + state only; a work-rights line. At intake, not generation.
7. **Specify the close** in the live cover letter prompt; add the banned closes to a cover-letter-only lint list.
8. **Archive the orphaned engine** so the system stops looking more governed than it is.

**What I would not do:** move the bulk of the doctrine onto the live path. Intake runs once per user and can afford a large prompt and a real gate. Tailoring from a clean baseline is a small job. Keep the generation path small and fast — that's what makes the product feel good to use.
