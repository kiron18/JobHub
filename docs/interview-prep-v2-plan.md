# Interview Prep V2 — closing the gap to the coach-written prep

**Date:** 2026-08-24
**Reference artefact:** `Khushal - Linfox Screening Call Prep.pdf` (Kiron, hand-written)
**Goal:** when a client opens the interview view on an application, they get that document, generated.

---

## 1. What the reference document is

It is not an interview guide. It is a **call companion for one specific round**, written to sit
open on screen during the call. Eleven sections:

| # | Section | Function |
|---|---------|----------|
| 0 | Header | Names the exact round, contract type, location, who prepared it, and "keep this open during the call" |
| 1 | The One Rule | A single governing principle. Everything downstream is justified against it |
| 2 | Your opening position | An exact script (`SAY THIS`), a separate "why it works", and one fallback line for the sharpest objection |
| 3 | Two things in the ad most candidates miss | Close reading of the ad, quoted verbatim, plus what not to be filed as |
| 4 | Four proof points in their words | Two-column map, ad phrase to your line. Each anchored to a named employer and one number. Plus two spares, plus a caution about a story not on the resume, plus the one-number-per-answer rule |
| 5 | Do not say the cliché, show it | Four personalised claim-to-evidence substitutions |
| 6 | The seven questions you are most likely to get | Script or tactic per question, a question handed back, salary tactics, availability |
| 7 | The four things you cannot fumble | Visa type and expiry against contract length, on-site expectation, background and drug checks, the employment gap |
| 8 | Forty-five minutes before the call | Domain vocabulary, company basics, reporting line, physical setup |
| 9 | Your question, and your close | Pick one or two, then an exact closing line, then the same-day thank-you |
| 10 | Tone | Two-second pause, do not fill the silence, one number per answer, banned phrases |
| 11 | The whole call in one paragraph | The compressed reduction |

### The properties that make it work

1. **It is round-specific.** A recruiter phone screen, not "an interview". Content for a panel
   or a technical round would be different.
2. **It scripts.** Most of the page is words to say, marked and quoted, with the rationale kept
   visually separate so the script stays scannable mid-call.
3. **It reads the ad closely** and quotes it back ("rather than a purely technical IT background").
4. **It names the liability once** and gives exactly one place to admit it.
5. **It uses facts from outside the ad**: Linfox founded 1956, ~24,000 people, what a rate card
   and an accessorial charge are, who the role reports to.
6. **It knows the candidate's logistics**: visa, availability, current casual work, why the last
   contract ended, salary band, comfort with on-site.
7. **It flags what is not on the resume** and tells him to introduce it rather than assume.
8. **It is calm and second-person.** Delivery mechanics are treated as content, not filler.

---

## 2. What JobHub does today

**Entry point.** Not a tab. `src/components/tracker/JobCard.tsx:1237` renders a link inside an
expanded application card, only when `status === 'INTERVIEW'`, pointing at `/interview/:jobId`.

**Generation.** `src/pages/InterviewPrepWorkspace.tsx:44` posts to `/generate/interview-prep`
with `jobDescription` and `jobApplicationId` only. No achievements, no company research, no round,
no candidate logistics. The server (`server/src/routes/generate.ts`) runs the standard two-stage
blueprint pipeline against `server/rules/interview_prep_rules.md`, which asks for markdown under
six fixed headings.

**Render.** `src/components/InterviewPrepView.tsx` line-regex parses that markdown into Your Edge,
Know the Stage, Story Bank (CAR cards), Prove It, Questions to Ask, then appends three hardcoded
components that are identical for every user: `MindsetAnchors`, `OnTheDay`, `FinalChecklist`.

### The decisive gap

**Prove It generates twelve questions and zero answers.** Revealing an "answer" prints the same
boilerplate every time: *"Open with your X story. Lead with the hook, expand through C-A-R."*
The reference document's entire value is that it says the words. JobHub says "deploy a story".

---

## 3. Section-by-section delta

| Reference document | JobHub today | Verdict |
|---|---|---|
| The One Rule | none | new |
| Opening position, exact words | `whyYou`, about the candidate, not a script | reshape to a script |
| One line for the biggest objection | Watch-Outs, bullets describing gaps | reshape to a script |
| Ad close-read, quoted phrases | Company Intelligence, generic facts | new |
| Proof points mapped to ad phrases | Story Bank CAR cards, not mapped to ad language | remap |
| Two spares for depth | none | new |
| Caution: story not on the resume | none | new, needs profile-vs-resume diff |
| Anti-cliché substitutions | one static weak/strong example, same for everyone | personalise |
| Seven likely questions **with scripts** | twelve questions, boilerplate reveal | **the main gap** |
| Salary: ask the band first, the daily-rate trap | none | new, `/research/salary` already exists |
| Four things you cannot fumble | none | new, needs stored logistics |
| Forty-five minutes before | static `OnTheDay` + `FinalChecklist` | keep as default, add a personalised layer |
| Your question and your close | Questions to Ask, no closing line | add close, prune to two |
| Tone and delivery | static `MindsetAnchors` | acceptable, personalise later |
| One-paragraph reduction | none | new |
| Round awareness | none | new, structural |

---

## 4. The bridge

Four bridges, in dependency order. The first one is the hard one, and it is not an LLM problem.

### Bridge A — inputs (the prep is only as good as what it knows)

The generator currently sees a job description. It needs six input streams.

| Input | Where it comes from | Status |
|---|---|---|
| Ad text, verbatim | `JobApplication.description` | exists, verify it holds text and not just a Seek URL after the recent apply-flow change |
| The resume actually sent for this job | `Document` on the same application | exists, never passed |
| Company facts | `POST /research/company` | endpoint exists, never called from this flow. Cache into the unused `JobApplication.companyIntel` column |
| Salary band | `POST /research/salary` | endpoint exists, never called from this flow |
| Domain vocabulary (rate card, charge code, accessorial) | new: one LLM pass over the systems and terms named in the ad | new |
| **Interview logistics** | **new: a short intake** | **new, blocking** |

**The intake is the load-bearing piece.** Kiron's document is strong because he knows Khushal's
visa, notice, salary expectation and why IT Mate ended. Split it:

*Profile-level, asked once, reused across every interview* (`CandidateProfile`):
- visa type and expiry (`visaStatus` exists as a free string, needs structure)
- salary expectation and flexibility
- on-site or hybrid tolerance
- available from
- gap and departure explanations (why each role ended)

*Job-level, asked per interview* (`JobApplication`, one `interviewContext` Json column keeps the
migration small):
- round: recruiter screen, hiring manager, panel, technical, final
- format: phone, video, on-site
- scheduled at
- interviewer name and title, if known

Gate the build behind the intake: no logistics, no cannot-fumble section. Degrade honestly rather
than inventing a visa answer.

### Bridge B — the rules file

Rewrite `server/rules/interview_prep_rules.md` to the reference document's shape. Non-negotiables:

- **`SAY THIS` becomes a first-class output type.** Every script is verbatim, first-person, and
  separated from its rationale.
- **Round-conditional sections.** A recruiter screen gets logistics, salary and availability. A
  panel gets depth and competency spread. Follow the no-hardcoded-absolutes rule: one default
  shape with a round switch, not five forked prompts.
- **Every proof point quotes the ad** and names the employer and one number from the resume.
- **The liability is named once**, with the single line that acknowledges it.
- **Anti-cliché substitutions are personalised**, drawn from this candidate's actual material.
- Australian English, no em dashes, second person.

### Bridge C — the format

The current parser is a fragile line-regex over markdown. The richer document will break it.

**Recommendation: switch interview-prep to structured JSON**, validated with Zod, exactly as the
resume tab already does via `RESUME_STRUCTURED_PROMPT` + `applyPolish`. Store the JSON in
`Document.content` with a version marker.

Keep the existing markdown parser as the fallback path so documents generated before the switch
still render. `InterviewPrepView` already has a "Format updated, hit Re-generate" branch, so the
graceful-degradation surface exists.

### Bridge D — the surface

The current view is an accordion dashboard. The reference document is a single page you keep open
while the phone rings. That is a different object.

- One continuous scroll, not nested collapsibles. Scripts must be visible without a click.
- Scripts get a distinct visual treatment (the `SAY THIS` block), rationale is subordinate.
- The cannot-fumble items and the closing line stay reachable: sticky rail or a pinned footer.
- Print and PDF export that matches the reference layout. `src/lib/exportPdf.tsx` and
  `exportDocx.ts` already know the `interview-prep` doc type.
- Obey the page-scroll rule: `height: 100dvh`, `overflowY: auto`, centred by margin.

Entry point: the request was "the interview tab in the applications dashboard". Today it is a link
inside an expanded card. Decide whether Interview becomes a real tab in the tracker filter row or
stays a card action. Recommendation: keep the card link (it is per-application, and a tab implies a
list), but make it prominent and show the scheduled date once the intake captures it.

---

## 5. Phasing

**Phase 0 — inputs.** Interview intake form (profile-level once, job-level per interview), schema
additions, entry-point polish. No LLM changes. Nothing downstream works without this.

**Phase 1 — the scripts.** Rewrite the rules file, move to structured JSON + Zod, rebuild the view
around scripts. This alone closes the decisive gap.

**Phase 2 — research.** Wire `/research/company` and `/research/salary` into the flow, cache into
`companyIntel`, add the domain-vocabulary pass. This produces sections 3, 6 and 8.

**Phase 3 — the coach's touches.** Personalised anti-cliché substitutions, the two spares, the
not-on-the-resume caution (needs a profile-vs-resume diff), the one-paragraph reduction.

**Phase 4 — export.** PDF that matches the reference document, so it can be sent as a deliverable
the way Kiron sends it today.

---

## 6. Open decisions

1. **Intake friction.** Six to eight questions before the prep generates. Acceptable, or should
   Phase 1 ship a degraded prep with an "add your details to unlock the rest" prompt?
2. **Round selection.** Ask the client, or infer from the ad and application stage?
3. **Interview tab vs card link** in the tracker.
4. **Answer bank reuse.** `AnswerBankEntry` holds approved, candidate-confirmed spoken answers.
   Those are literally the words the person can say. Feeding them into the script generator would
   raise fidelity sharply, and nothing in the generation pipeline touches the answer bank today.
