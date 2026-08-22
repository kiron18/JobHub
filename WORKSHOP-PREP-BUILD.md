# Build spec: workshop prep console

Agreed 17 Aug 2026. Build this in **JobHub** (launch Claude Code at `E:/AntiGravity/JobHub`).

Goal: at 4pm on workshop day Kiron opens one page, presses two buttons, and has a
run sheet plus a fact sheet on every attendee with their resume one click away.

---

## What already exists (do not rebuild)

- `server/prisma/schema.prisma` → `SessionRegistration` holds name, email, `resumeText`,
  `resumeFile` (real bytes), `resumeFilename`, `sessionKey`, `attendedAt`, `report`.
- `server/src/routes/admin-sales.ts` → `GET /api/admin/sales/:id/resume` already serves
  the original resume file. Reuse it, do not write a second one.
- `server/src/config/workshop.ts` → next session date, `MEET_LINK`, `SKOOL_URL`,
  weekly roll. Everything time dependent is a function, never a module constant.
- `server/src/services/llm.ts` → `callClaude`, `PREMIUM_MODEL`.
- `src/pages/AdminSales.tsx` → the board, at `/admin/sales`.

## What is missing

The qualifying questions were removed from `SessionSignupPage.tsx`, so **nothing
collects attendee questions any more**. Questions now live in the Skool thread, and
**Skool has no API**, so they have to be pasted in by hand. That manual step cannot
be removed. Everything else is automatic.

---

## The build, in order

### 1. Migration
Three columns on `SessionRegistration`:
- `question String?` — their question, verbatim
- `coachBrief Json?` — the generated fact sheet
- `coachBriefAt DateTime?`

### 2. `server/src/routes/admin-workshop.ts` (new)
Behind the same `authenticate` + `requireAdmin` used by `admin-sales.ts`.
- `GET  /api/admin/workshop?session=<key>` — roster, counts, session meta
- `POST /api/admin/workshop/questions` — paste box lands here
- `POST /api/admin/workshop/brief/:id` — one fact sheet
- `POST /api/admin/workshop/brief-all` — the whole room

### 3. `server/src/services/coachBrief.ts` (new)
One prompt, one LLM call over resume text + their question. Output is exactly six
short lines, because Kiron reads it while talking:
1. Who they are in one line (degree, field, years, visa if stated)
2. Where they are actually stuck, read off the resume
3. Their question, and which gap it lands in (1 targeting / 2 outcomes / 3 outreach / 4 system)
4. One thing to say their name next to
5. One resume line to rewrite live, **quoted verbatim** so it can be read aloud
6. Hot / warm / cold, with the reason

Cache on the row. Never regenerate on read.

⚠️ Inherit the EVIDENCE RULE from `services/diagnosticReport.ts`: never state a number
about a candidate that is not in their documents.

### 4. `src/pages/AdminWorkshop.tsx` (new), route `/admin/workshop`
Linked from the sales board. Four blocks:

- **Header strip** — date, countdown, Meet link (copy), claim link (copy), Skool link,
  counts of registered / resumes in / questions in. A chip that flips red at T minus 60
  reading "Close the thread now". Kiron closes it in Skool himself; the page only tells him when.
- **Paste box** — one textarea. Paste the whole Skool thread, press Match. An LLM pass
  splits it into (poster, question) and matches to the roster by name. Review table with
  a dropdown to fix wrong matches. Unmatched questions survive as floor questions.
- **Roster** — one card each, resume+question first. Name, registered when, question
  verbatim, **Open resume** button, **Fact sheet** button, **Generate all**.
- **Run sheet** — generated, not hand written. Timings table derived from the real start
  time, name check list, the rules, the offer line.

### 5. `src/config/runsheet.ts` (new)
The run sheet template. Model it on `Daekwon/WEBINAR-RUNSHEET.md` (the 6 Aug one),
which is the proven shape: the room table, the timings table, the rules, the hard cap
on the demo.

### 6. "Open the read"
One button. Run sheet plus every fact sheet in one long page, large type. The only tab
open during the call.

---

## House rules that apply

- **No em dashes** in anything user facing.
- Nothing time dependent may be read once at module load. See the warning at the top of
  `config/workshop.ts`; a hoisted session key froze the whole funnel for a week.
- `WORKSHOP_MEET_LINK` is the single source of the Meet link. Never hardcode one.
