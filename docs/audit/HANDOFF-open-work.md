# Handoff — open work as of 2026-07-30

Written so this chat can be cleared without losing the thread. Durable architecture decisions are in agent memory (`jobhub-generation-architecture`, `jobhub-intake-and-honesty-fixes`) — this file is the **open items** only.

---

## 1. Revathi Sridhar Surya — waiting on her answers

**Status:** paused pending her reply. When it lands, revise and **deliver a PDF**.

**Files already produced (in `C:\Users\Kiron\Downloads\`):**
| File | What it is |
|---|---|
| `Surya_resume_APP_READY.md` | Cleaned main resume. Restructured only, **zero numbers invented**. |
| `Surya_message_to_send.txt` | 6 questions to send her + notes for Kiron on what changed. |
| `Surya_resume (2)_260701_214008 (2) (1).pdf` | Her original main resume (dev/AI framing). |
| `Surya_tester_resume.pdf` | Her second resume (QA/tester framing). |

**Her targets:** software developer AND AI engineer. Decision made: **one master resume**, not two. The app already reorders/reweights per job ad, so no new feature is needed. Stack names on each project are the routing signal (React/Node → dev; XGBoost/TensorFlow/ViT → AI).

**The tester resume contains facts missing from the main one — fold these in:**
- Phone `+61 493 936 282` (main resume has no phone at all)
- **Work rights: Temporary Graduate Visa (Subclass 485), full working rights** — highest-value missing line, goes on the contact line, costs no extra space
- Cypress, SQL, SDLC/STLC, mobile testing (Android), defect severity triage
- "Master of IT conferred January 2026"
- Remove "Happy testing." from her skills list

**Two contradictions between her two resumes — MUST resolve with her before generating:**

| Item | Main resume | Tester resume |
|---|---|---|
| Heritage Tourism app | "**Built** a heritage booking application featuring QR ticketing, landmark recognition, crowd prediction" | "**Manual Tester – Android.** Conducted manual testing of the Android version" |
| UNSW capstone | "Built role-based features… interacted directly with the client" | "Assigned as **frontend developer**; additionally carried out manual and automated testing" |

The Heritage one is serious — one version claims she built an ML pipeline, the other that she tested an Android build. Added as questions 7 and 8.

**Unresolved details:** the GitHub link ending `task-scheduling-with-replit2.2` looks broken (left off rather than publish a dead link). "AI-Assisted Automated Testing" shortened to "automated testing" — nothing in her projects evidences the AI-assisted part.

**Upload note:** save as `.docx`, not PDF. Verified 2026-07-30 across 89 resume PDFs — the `.docx` path (mammoth) is structurally reliable; PDF extraction occasionally mangles fonts (one real client resume had every "ti" become "P") and destroys spacing on LaTeX-generated files.

---

## 2. Onboarding email — drafted, needs one input

`C:\Users\Kiron\Downloads\JobHub_onboarding_email.md` — two versions, Version A recommended.

**Blocked on:** the live app domain. Placeholder `APP_URL` needs replacing; I could not find it in repo config. Route is `/welcome`.

Flow it describes (verified in `src/pages/WelcomePage.tsx:16`): upload → loading → brief → roles → email → 6-digit code → done. No password.

---

## 3. Committed / uncommitted state

**Changed, not committed:** `server/src/services/diagnosticReport.ts` — the EVIDENCE RULE fix. Verified: typecheck clean, 24 diagnostic tests pass, full suite 421 tests pass, behaviour confirmed twice on a real CV (0 invented figures, quality preserved).

**Deliberately reverted:** `server/src/lib/groundingGate.ts` and its test are back to original. The single-digit check is **paused, not abandoned** — see memory for the four false-positive paths and the conditions for revisiting.

**Untracked:** `docs/audit/` (this file plus `PROMPT-SURFACE-MAP.md`, `PROMPT-SURFACE-BUNDLE.md`, `SYSTEM-EVALUATION.md`).

---

## 4. Next things worth doing (ranked, none started)

1. **Wire the fixed baseline into generation.** Highest leverage. Generation still reads the unfixed original upload. Store the fixed version as TEXT — never as fields (see memory for why).
2. **Fix the output length contradiction** in `generationV2.ts`: "aim for 2 A4 pages" vs "never delete an entry or a section" (the latter has priority, so long histories produce 3-page resumes). Port the old bullet budget: 3-4 bullets for the most relevant roles, 1-2 for the rest, 10-14 total. **Do this before enriching any master resume**, or a richer source makes output worse.
3. **Pin section order** with a mandatory catch-all clause. Currently the model picks the order per run, so the same inputs give different layouts.
4. **Build the intake question form.** The diagnostic's bracket blanks are already the question list.
5. Put the good CTA lines from `cover_letter_rules.md` into the live cover letter prompt, and add the banned closes to a cover-letter-only lint list.

## 5. Standing constraints

- Kiron's doctrine: **fewer rules, no contradictions.** Verified as substantially correct — contradictory rules are worse than no rules. A rule should only exist for something the model can't know or gets wrong by default.
- Cover letter length: **leave at 400–500.** That was a deliberate change from 250–350 (commit `1b8bc3e`) and his call. Do not re-litigate.
- Skills section high on the page for this client base — most have no local Australian experience, so the skills block and the local qualification are the trust anchors.
- `CLAUDE_MODEL_PREMIUM` is unset, so "premium" retries run on the same Sonnet 4.5 as everything else.
- Check whether `LLAMA_CLOUD_API_KEY` is set on Railway. It's set locally; if it's missing in production, every PDF upload falls back to the crude parser.
