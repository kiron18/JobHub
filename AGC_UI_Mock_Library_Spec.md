# AGC UI Mock Library — Build Spec

**Date:** 2026-05-24
**For:** DeepSeek agent (one-shot build)
**Companion to:** `AGC_Carousel_Design_System_Prompt.md`
**Output location:** `carousels/src/shared/ui-mocks/`

---

## 0. Read this first

You are building a small **HTML mock library** of the JobHub product UI. Each mock is a self-contained, slot-templated HTML snippet that the carousel system can embed inside a slide to show a feature in action without needing real product screenshots.

The mocks are **brand-perfect, hand-crafted approximations** of the real JobHub UI surfaces — same warm tokens, same typography, same shadows — but written from scratch as clean static HTML so they can be re-skinned per slide via slot variables (`{{JOB_TITLE}}`, `{{COMPANY}}`, etc).

You will produce **8 mock surfaces** (listed in §3). For each one, you deliver:
1. A standalone `.html` file (previewable in a browser on its own).
2. A `.recipe.md` sidecar listing the slots, the real JobHub component it mirrors, and example values.

**Hard constraints:**
- Use **literal hex values** from the token block in §1. Do NOT use CSS variables — these mocks are inlined into slides that already define their own variables, and variable collisions are exactly the failure mode we're trying to prevent.
- Every mock's CSS must be scoped to `.jobhub-mock--<mock-name>` so it cannot leak into the parent slide's styles.
- Every text element that varies per slide must use a `{{SLOT_NAME}}` placeholder.
- Pixel sizes are in raw `px`. The slide system scales mocks via CSS `transform: scale()` when needed — your mock must render at its natural size first.
- Run the **Pre-Output Self-Audit** in §6 before delivering each mock.

If you cannot find an asset, slot, or detail that's genuinely ambiguous, leave a `<!-- TODO(spec): question -->` comment in the HTML and continue. Do not invent.

---

## 1. Token block — use these literal values everywhere

```
Backgrounds
  Canvas:     #FAF7F2
  Surface:    #FFFFFF
  Alt fill:   #F4EFE8
  Deep dark:  #2A2520

Text
  Primary:    #1A1814
  Secondary:  #5C5750
  Muted:      #8B847B
  On-deep:    #FAF7F2

Accents
  Petrol:        #2D5A6E
  Petrol hover:  #1F4253
  Gold:          #C5A059
  Gold soft:     #E8D7B0
  Success green: #2A9D6F
  Danger red:    #B85C5C

Borders
  Whisper:    rgba(26, 24, 20, 0.08)
  Defined:    rgba(26, 24, 20, 0.16)

Shadows
  Soft:    0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04)
  Lifted:  0 1px 3px rgba(26,24,20,0.04), 0 6px 20px rgba(26,24,20,0.06), 0 18px 48px rgba(26,24,20,0.04)

Radius
  Input/button:  10px
  Card:          16px
  Pill:          9999px

Type
  Display:  'Fraunces', Georgia, 'Times New Roman', serif
  Body:     'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif
```

Fonts are loaded by the parent slide HTML — do NOT add `<link>` tags inside mock files.

---

## 2. Output structure

```
carousels/src/shared/ui-mocks/
  analyse-card.html
  analyse-card.recipe.md
  process-strip.html
  process-strip.recipe.md
  tracker-pipeline.html
  tracker-pipeline.recipe.md
  editor-with-rewrites.html
  editor-with-rewrites.recipe.md
  diagnostic-card.html
  diagnostic-card.recipe.md
  section-intro-banner.html
  section-intro-banner.recipe.md
  linkedin-toolkit-card.html
  linkedin-toolkit-card.recipe.md
  email-template-card.html
  email-template-card.recipe.md
```

### 2.1 File shape — every `.html` follows this exact structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JobHub mock — <mock name></title>
<style>
  /* Reset only inside the mock scope */
  .jobhub-mock--<mock-name>, .jobhub-mock--<mock-name> * {
    margin: 0; padding: 0; box-sizing: border-box;
    font-family: 'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif;
  }
  .jobhub-mock--<mock-name> {
    /* root mock styles — all literal hex from §1 */
  }
  /* component-internal styles, all class-prefixed to keep them scoped */
</style>
</head>
<body style="background:#FAF7F2; padding:48px; display:flex; align-items:center; justify-content:center;">

<section class="jobhub-mock jobhub-mock--<mock-name>" style="width: <mock-width>px;">
  <!-- mock markup with {{SLOT_NAME}} placeholders -->
</section>

</body>
</html>
```

The `<body>` wrapper is for **standalone preview only** — when embedded into a slide, the carousel renderer extracts the `<style>` block and the `<section>` element separately. So:

- The `<style>` MUST only reference `.jobhub-mock--<mock-name>` and its descendants. No global selectors. No `body`, no `*`, no element selectors.
- The `<section>` MUST be a single root element that the renderer can lift out cleanly.

### 2.2 Slot variable syntax

Placeholders are `{{UPPER_SNAKE_CASE}}` — interpolated by the carousel system at build time.

- Always wrap in double braces: `{{JOB_TITLE}}`, not `{JOB_TITLE}` or `${JOB_TITLE}`.
- One slot, one purpose. Don't reuse a slot name for two different concepts in the same mock.
- For optional/conditional content, use `{{#if SLOT}}...{{/if}}` blocks. Keep these to a minimum — prefer always-rendered content with sensible defaults.

Example, inside an `<h2>`:
```html
<h2 class="jh-card-title">{{JOB_TITLE}}</h2>
```

### 2.3 Recipe sidecar shape — every `.recipe.md`

```markdown
# <mock-name> recipe

**Mirrors:** `<path to real JobHub component>` (for visual reference when re-syncing)
**Natural width:** <px>
**Natural height:** <px>
**Used for:** <one sentence — what carousels typically use this for>

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{JOB_TITLE}}` | string | "Senior Marketing Manager" | Truncates at 60 chars in real UI |
| `{{COMPANY}}` | string | "Atlassian" | |
| `{{MATCH_SCORE}}` | number 0–100 | 87 | Drives the badge colour: <50 red, 50-74 amber, 75+ green |
| ... | | | |

## Visual notes

- <anything a future re-skinner needs to know that isn't obvious from looking at the file>
- <if a section is conditionally shown, explain when>

## Last verified against real UI

Date: 2026-05-24
```

---

## 3. The 8 mocks to build

For each mock, the section below gives: what it shows, the JobHub source component (for your visual reference if you can access the repo — otherwise rely on the description), natural dimensions, and the required slots.

### 3.1 `analyse-card`

**Shows:** The "Analyse a Role" card on the JobHub dashboard — a paste-the-JD textarea and an Analyse button. The most-shown UI in the product.

**Mirrors:** `src/pages/StrategyHub.tsx` (the textarea around line 540, button around line 629)

**Natural size:** 720px wide × auto height (~360px tall when rendered with default slot content).

**Structure (described):**
- Outer card: `#FFFFFF` background, `1px solid rgba(26,24,20,0.08)` border, `16px` radius, soft shadow.
- Padding: `28px`.
- Eyebrow label at top: "ANALYSE A ROLE" in uppercase, Geist 600, 11px, letter-spacing 0.12em, colour `#5C5750`.
- Below the eyebrow: a small "Browse jobs on Seek" pill link card — `#FFFFFF` background, `1px solid rgba(26,24,20,0.08)`, `10px` radius, padding `12px 16px`, text `#1A1814` Geist 600 14px, with a small external-link icon (use an inline SVG of a 12px box-with-arrow icon, stroke `#5C5750`).
- The main textarea: full width, min-height 140px, border `1px solid rgba(26,24,20,0.08)`, `12px` radius, padding `14px 16px`, font Geist 14px, color `#5C5750`. The slot `{{TEXTAREA_PLACEHOLDER}}` controls its placeholder/content. Background `#F4EFE8`.
- Below the textarea, a horizontal row: on the left a toggle "Generate selection criteria responses" (toggle is a small pill — `28px × 16px` track, `12px` circular knob in `#2D5A6E` when on); on the right the Analyse button.
- Analyse button: Geist 700 14px, `#FFFFFF` text, background `#2D5A6E`, padding `12px 22px`, `12px` radius, with a small right-chevron icon after the word "Analyse".

**Slots:**
| Slot | Example |
|------|---------|
| `{{BROWSE_PILL_TEXT}}` | "Browse marketing jobs on Seek" |
| `{{TEXTAREA_PLACEHOLDER}}` | "Paste the job description here…" |
| `{{TOGGLE_ON}}` | `true` or `false` — controls visual state of the SC toggle |

### 3.2 `process-strip`

**Shows:** The 5-step Process Strip — Paste → Analyse → Tailor → Save → Track.

**Mirrors:** `src/components/processStrip/ProcessStrip.tsx`

**Natural size:** 720px wide × ~140px tall.

**Structure:**
- Outer card: `#FFFFFF`, `1px solid rgba(26,24,20,0.08)`, `16px` radius, soft shadow, padding `16px 20px`.
- Horizontal row of 5 step nodes with connector segments between adjacent nodes.
- Each node is a `28px × 28px` circle.
  - Completed step: filled `#C5A059`, white check icon (12px).
  - Current step: filled `#2D5A6E`, white step number, plus a `2px` ring `rgba(45,90,110,0.40)` around it (no animation — this is a static mock).
  - Future step: transparent fill, `1.5px solid rgba(26,24,20,0.08)`, step number in `#8B847B`.
- Connector segments: `height: 2px`, `flex: 1`. Gold (`#C5A059`) if BOTH adjacent steps are completed; whisper border colour otherwise.
- Label under each node: Geist 600 11px, colour `#8B847B` (or `#1A1814` for the current step), centred. Labels: Paste / Analyse / Tailor / Save / Track.
- Below the row of nodes, a single caption line for the current step: Geist 400 12px, colour `#5C5750`, `marginTop: 12px`, centred.

**Slots:**
| Slot | Example |
|------|---------|
| `{{CURRENT_STEP}}` | `"analyse"` — one of `paste`, `analyse`, `tailor`, `save`, `track`. Drives which node is current and which are completed (all prior steps to the current one are completed). |
| `{{CAPTION}}` | "Hit Analyse. We'll build your tailored resume and cover letter." |

Since the slot system is text-only, the way to handle `{{CURRENT_STEP}}` is: define five hardcoded variants of the strip (one per step) inside the file, and use a CSS attribute selector on the `<section data-step="{{CURRENT_STEP}}">` to show the right state via display rules. Pre-render all 5 inside the section but only show the matching one. This is the only mock where this pattern is needed — every other mock takes scalar string slots only.

### 3.3 `tracker-pipeline`

**Shows:** A vertical stack of 3 job cards in the tracker, each with a different status (SAVED, APPLIED, INTERVIEW), demonstrating the pipeline at a glance.

**Mirrors:** `src/components/ApplicationTracker.tsx` rendering `src/components/tracker/JobCard.tsx` (the collapsed card)

**Natural size:** 720px wide × ~440px tall (3 cards stacked with 12px gap).

**Structure of each card:**
- White surface, whisper border, `18px` radius, soft shadow.
- Padding `20px 24px`.
- Top row: status pill on the left, "applied X days ago" timestamp on the right (Geist 400 12px `#8B847B`).
- Status pill: `8px 14px` padding, `9999px` radius, Geist 700 11px uppercase. Colours per status:
  - SAVED: background `#F4EFE8`, text `#5C5750`
  - APPLIED: background `rgba(42,157,111,0.12)`, text `#2A9D6F`
  - INTERVIEW: background `rgba(197,160,89,0.18)`, text `#C5A059`
- Below the pill: job title in Fraunces 600 22px `#1A1814`, then company name + location on a single line in Geist 500 14px `#5C5750`.
- Below that: a single small row with 3 icon-plus-label items (e.g., docs ready, follow-up due in N days, salary range) — Geist 400 12px `#8B847B`. Use simple inline SVG icons (file, clock, dollar).

**Slots (per card — use indexed slots):**
| Slot | Example |
|------|---------|
| `{{JOB1_TITLE}}` | "Senior Marketing Manager" |
| `{{JOB1_COMPANY}}` | "Atlassian · Sydney" |
| `{{JOB1_STATUS}}` | `SAVED` |
| `{{JOB1_AGE}}` | "Started 2 days ago" |
| `{{JOB2_TITLE}}` etc. | |
| `{{JOB3_TITLE}}` etc. | |

(Three cards, JOB1/JOB2/JOB3 prefixes.)

### 3.4 `editor-with-rewrites`

**Shows:** A slice of the application editor showing a resume bullet with an AI-rewrite badge inline.

**Mirrors:** `src/components/ApplicationWorkspace.tsx` + `src/components/AIRewriteBadge.tsx`

**Natural size:** 720px wide × ~340px tall.

**Structure:**
- Outer card: white surface, whisper border, `16px` radius, soft shadow, padding `28px`.
- Tab bar at top: 3 small pill tabs (Resume / Cover letter / Selection criteria), active tab is `#2D5A6E` background with `#FFFFFF` text, inactive tabs are transparent with `#5C5750` text. Padding `6px 14px`, `9999px` radius, Geist 600 12px.
- Below tabs: a Fraunces 600 18px section heading "Achievements".
- Below that: 2 bullet points, each is a list item with a `6px × 6px` rounded square marker in `#2D5A6E`, then the bullet text in Geist 400 14px `#1A1814`, line-height 1.6.
- One bullet is "normal", one has an inline `[AI]` badge before the text: a small `4px 8px` pill, background `rgba(197,160,89,0.18)`, text `#C5A059`, Geist 800 9px uppercase, letter-spacing 0.08em.
- Below the bullets: a row of action buttons. Left: a ghost "← Back" button. Right: a secondary "Review" button + a primary "Save & continue" button. Use the same button styling as the analyse card (primary = petrol bg white text).

**Slots:**
| Slot | Example |
|------|---------|
| `{{ACTIVE_TAB}}` | `"resume"` — one of `resume`, `cover`, `criteria`. Use the same hardcoded-variants pattern as the process-strip. |
| `{{BULLET_NORMAL}}` | "Led the migration of 14 legacy customer reporting workflows…" |
| `{{BULLET_REWRITTEN}}` | "Rebuilt the data ingestion pipeline, cutting client report turnaround from 14 days to under 6 hours." |

### 3.5 `diagnostic-card`

**Shows:** One finding card from the diagnostic report — a "problem identified → fix applied" pair.

**Mirrors:** `src/components/DiagnosticPage.tsx` (a single finding section)

**Natural size:** 720px wide × ~300px tall.

**Structure:**
- Outer card: `#FFFFFF` surface, `1px solid rgba(26,24,20,0.08)`, `16px` radius, lifted shadow, padding `32px`.
- Top: a small uppercase eyebrow "FIX 03" in Geist 800 11px letter-spacing 0.12em, colour `#C5A059`.
- Below the eyebrow: a Fraunces 700 28px headline `{{FINDING_TITLE}}` in `#1A1814`.
- Below: a 2-column layout (CSS grid 1fr 1fr, gap 24px):
  - **Left column** ("BEFORE"): a small uppercase label "BEFORE" Geist 800 10px `#B85C5C`, then a quote box with `#F4EFE8` background, `1px solid rgba(184,92,92,0.20)`, `10px` radius, padding `16px`. Inside: text in Geist 400 13px italic `#5C5750`.
  - **Right column** ("AFTER"): label "AFTER" `#2A9D6F`, quote box with `#F4EFE8` background, `1px solid rgba(42,157,111,0.20)`. Text in Geist 500 13px `#1A1814` (not italic).
- Below the grid: a one-line caption explaining the change. Geist 400 13px `#5C5750`, padding-top `20px`, border-top `1px solid rgba(26,24,20,0.08)`.

**Slots:**
| Slot | Example |
|------|---------|
| `{{FIX_NUMBER}}` | "03" |
| `{{FINDING_TITLE}}` | "Your opening line introduces you. It should sell you." |
| `{{BEFORE_TEXT}}` | "I am a results-driven marketing professional with 5 years of experience…" |
| `{{AFTER_TEXT}}` | "Drove $2.3M in pipeline at Atlassian by rebuilding the SMB outbound motion from scratch." |
| `{{EXPLANATION}}` | "The 'after' version names the company, quantifies impact, and states the action you took. Recruiters scan for these three signals in the first 3 seconds." |

### 3.6 `section-intro-banner`

**Shows:** The dismissible inline banner that appears at the top of each section page on first visit.

**Mirrors:** `src/components/processStrip/SectionIntroBanner.tsx`

**Natural size:** 720px wide × ~84px tall.

**Structure:**
- A horizontal banner: `#F4EFE8` background, `1px solid rgba(26,24,20,0.08)`, `16px` radius, padding `16px 20px`.
- Left side (flex 1): body text in Geist 400 14px `#5C5750`, line-height 1.55.
- Right side: a small `×` close button — Geist 400 14px `#8B847B`, padding `4px`, no background. Use an inline SVG of a 14px X icon, stroke `#8B847B`.

**Slots:**
| Slot | Example |
|------|---------|
| `{{BANNER_TEXT}}` | "70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, headline drafts." |

### 3.7 `linkedin-toolkit-card`

**Shows:** One feature card from the LinkedIn page (e.g., "Profile Rewrite", "Outreach Templates", "Headshot Generator").

**Mirrors:** `src/components/linkedin/SectionCard.tsx`

**Natural size:** 360px wide × ~220px tall (designed to sit in a 2-column grid of two cards side-by-side on a 720px-wide canvas).

**Structure:**
- Outer card: `#FFFFFF` surface, whisper border, `16px` radius, soft shadow, padding `24px`.
- Top: a `36px × 36px` icon tile (background `rgba(45,90,110,0.10)`, `10px` radius, inline SVG icon centred in `#2D5A6E`).
- Below the icon: Fraunces 600 20px title `{{CARD_TITLE}}` in `#1A1814`.
- Below the title: Geist 400 13px body `{{CARD_BODY}}` in `#5C5750`, line-height 1.55, max 2 lines.
- Below the body: a small "Open →" link in Geist 700 12px `#2D5A6E` uppercase, letter-spacing 0.06em.

**Slots:**
| Slot | Example |
|------|---------|
| `{{ICON_SVG}}` | inline SVG snippet — pass a placeholder LinkedIn logo if no specific icon |
| `{{CARD_TITLE}}` | "Outreach Templates" |
| `{{CARD_BODY}}` | "Pre-written messages for every networking stage — from cold connection to direct ask." |

### 3.8 `email-template-card`

**Shows:** One email template card from the templates library.

**Mirrors:** `src/components/EmailTemplatesLibrary.tsx`

**Natural size:** 720px wide × ~280px tall.

**Structure:**
- Outer card: `#FFFFFF`, whisper border, `16px` radius, soft shadow, padding `28px`.
- Top row: a category pill on the left (e.g. "Follow-up · After application") — `6px 12px` padding, `9999px` radius, `rgba(45,90,110,0.10)` background, `#2D5A6E` text, Geist 700 10px uppercase. On the right, a copy-button icon (inline SVG of a 14px copy icon, stroke `#8B847B`).
- Below: Fraunces 600 20px title `{{TEMPLATE_TITLE}}` in `#1A1814`.
- Below the title: the email body preview in `#F4EFE8` background, `10px` radius, padding `16px`, Geist 400 13px `#5C5750`, line-height 1.6, white-space pre-line (so `\n` in slot renders as line breaks).
- Bottom row: a Geist 400 11px `#8B847B` "Personalisable · 3 fields to fill" note.

**Slots:**
| Slot | Example |
|------|---------|
| `{{CATEGORY_LABEL}}` | "Follow-up · After application" |
| `{{TEMPLATE_TITLE}}` | "Polite 7-day follow-up" |
| `{{EMAIL_BODY}}` | "Hi {Hiring Manager},\n\nI applied for the {role} position last week and wanted to reaffirm my interest…" |
| `{{PERSONALISE_NOTE}}` | "Personalisable · 3 fields to fill" |

---

## 4. Worked example — `analyse-card.html`

Use this as the template pattern for the other mocks. The structure, scoping, and slot syntax must match.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JobHub mock — analyse card</title>
<style>
  .jobhub-mock--analyse-card,
  .jobhub-mock--analyse-card * {
    margin: 0; padding: 0; box-sizing: border-box;
    font-family: 'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif;
  }

  .jobhub-mock--analyse-card {
    background: #FFFFFF;
    border: 1px solid rgba(26, 24, 20, 0.08);
    border-radius: 16px;
    box-shadow: 0 1px 2px rgba(26,24,20,0.04), 0 4px 16px rgba(26,24,20,0.04);
    padding: 28px;
    width: 720px;
  }

  .jobhub-mock--analyse-card .jh-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5C5750;
    margin-bottom: 16px;
  }

  .jobhub-mock--analyse-card .jh-browse-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #FFFFFF;
    border: 1px solid rgba(26, 24, 20, 0.08);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 14px;
    color: #1A1814;
    font-weight: 600;
    font-size: 14px;
  }

  .jobhub-mock--analyse-card .jh-browse-link svg {
    color: #5C5750;
  }

  .jobhub-mock--analyse-card .jh-textarea {
    width: 100%;
    min-height: 140px;
    background: #F4EFE8;
    border: 1px solid rgba(26, 24, 20, 0.08);
    border-radius: 12px;
    padding: 14px 16px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    color: #5C5750;
    margin-bottom: 20px;
  }

  .jobhub-mock--analyse-card .jh-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .jobhub-mock--analyse-card .jh-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #5C5750;
    font-size: 13px;
    font-weight: 500;
  }

  .jobhub-mock--analyse-card .jh-toggle-track {
    width: 28px;
    height: 16px;
    background: rgba(26, 24, 20, 0.16);
    border-radius: 9999px;
    position: relative;
  }

  .jobhub-mock--analyse-card[data-toggle-on="true"] .jh-toggle-track {
    background: #2D5A6E;
  }

  .jobhub-mock--analyse-card .jh-toggle-knob {
    width: 12px;
    height: 12px;
    background: #FFFFFF;
    border-radius: 9999px;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.15s;
  }

  .jobhub-mock--analyse-card[data-toggle-on="true"] .jh-toggle-knob {
    left: 14px;
  }

  .jobhub-mock--analyse-card .jh-button-analyse {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #2D5A6E;
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    padding: 12px 22px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
    cursor: default;
  }
</style>
</head>
<body style="background:#FAF7F2; padding:48px; display:flex; align-items:center; justify-content:center;">

<section class="jobhub-mock jobhub-mock--analyse-card" data-toggle-on="{{TOGGLE_ON}}">
  <p class="jh-eyebrow">Analyse a Role</p>

  <div class="jh-browse-link">
    <span>{{BROWSE_PILL_TEXT}}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  </div>

  <div class="jh-textarea">{{TEXTAREA_PLACEHOLDER}}</div>

  <div class="jh-controls">
    <label class="jh-toggle">
      <span class="jh-toggle-track">
        <span class="jh-toggle-knob"></span>
      </span>
      Generate selection criteria responses
    </label>
    <button class="jh-button-analyse">
      Analyse
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  </div>
</section>

</body>
</html>
```

And its recipe sidecar:

```markdown
# analyse-card recipe

**Mirrors:** `src/pages/StrategyHub.tsx` (Analyse a Role card, ~line 500–660)
**Natural width:** 720px
**Natural height:** ~360px
**Used for:** Onboarding carousels showing "start by pasting a job listing", apply-flow walkthroughs.

## Slots

| Slot | Type | Example | Notes |
|------|------|---------|-------|
| `{{BROWSE_PILL_TEXT}}` | string | "Browse marketing jobs on Seek" | Becomes the text of the pill link card. |
| `{{TEXTAREA_PLACEHOLDER}}` | string | "Paste the job description here…" | Shown as div content (not real placeholder). |
| `{{TOGGLE_ON}}` | "true" or "false" | "false" | Drives the SC toggle visual via data attribute. |

## Visual notes

- The Analyse button is a non-interactive mock — `cursor: default` is intentional.
- Inline SVG icons are used instead of icon font references for self-containment.
- The toggle uses a data attribute selector so the slot system can flip its state without re-rendering CSS.

## Last verified against real UI

Date: 2026-05-24
```

---

## 5. Inline SVG icon library

To keep mocks self-contained, every icon MUST be inline SVG. Use these reference icons (24×24 viewBox, scale via `width`/`height` attrs):

```html
<!-- Check -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>

<!-- X (close) -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

<!-- Chevron right -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>

<!-- External link -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>

<!-- Copy -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>

<!-- File -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>

<!-- Clock -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

<!-- Mail -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>

<!-- LinkedIn -->
<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
```

Set the `stroke` colour via the parent's `color` property — that's why `stroke="currentColor"` is used. Same for `fill` on the LinkedIn icon.

---

## 6. Pre-Output Self-Audit (run silently before delivering each mock)

For every `.html` file you produce, internally verify:

- [ ] Filename matches the spec exactly (`<mock-name>.html`).
- [ ] CSS is fully scoped under `.jobhub-mock--<mock-name>`. There are zero global selectors (`body`, `*`, element tag selectors).
- [ ] The mock uses **only** literal hex values from §1 (or rgba derivatives of them). Grep for `#[0-9A-F]{6}` and verify every result is in the palette.
- [ ] At least one accent colour (`#2D5A6E`, `#C5A059`, or `#2A9D6F`) appears on a visible element.
- [ ] All slot placeholders use double-brace `{{UPPER_SNAKE_CASE}}` form.
- [ ] No `<link>` tags inside the mock — fonts are loaded by the slide.
- [ ] No `<script>` tags.
- [ ] No external image references (`<img src="http://...">` or `<img src="/path/...">`). Only inline SVG.
- [ ] All `<img>` tags (if any) have explicit `width` and `height` attributes.
- [ ] No em dashes (— or `&mdash;`). Use comma, ellipsis, or rewrite.
- [ ] The `<section>` element is a single root element with class `jobhub-mock jobhub-mock--<mock-name>`.
- [ ] The standalone preview body has `background:#FAF7F2; padding:48px; display:flex; align-items:center; justify-content:center;`.
- [ ] A matching `.recipe.md` was produced.

If ANY check fails, fix before output.

---

## 7. Acceptance criteria

Run through this once all 8 mocks + recipes are produced:

- [ ] All 16 files (`8 × .html` + `8 × .recipe.md`) exist in `carousels/src/shared/ui-mocks/`.
- [ ] Each `.html` file opens in a browser and renders standalone without console errors or layout breakage.
- [ ] Each `.html` file's CSS contains zero global selectors. (Grep for `^body`, `^\*`, and element tags at start of CSS rules.)
- [ ] No file references CSS variables — every colour is a literal hex or rgba.
- [ ] No file imports fonts (no `<link>` tags). Fonts inherit from the slide.
- [ ] Each recipe enumerates all slots that appear in its mock — no orphan slots, no missing ones.
- [ ] All slot placeholders use the `{{UPPER_SNAKE_CASE}}` form and are not collide-prone (e.g., not nested inside another slot).

---

## 8. Order of execution

1. Build `analyse-card.html` + recipe — this is the template pattern. Verify it renders in a browser. Confirm with reviewer before continuing.
2. Build `process-strip.html` + recipe.
3. Build `tracker-pipeline.html` + recipe.
4. Build `editor-with-rewrites.html` + recipe.
5. Build `diagnostic-card.html` + recipe.
6. Build `section-intro-banner.html` + recipe.
7. Build `linkedin-toolkit-card.html` + recipe.
8. Build `email-template-card.html` + recipe.
9. Walk through §7 acceptance criteria.

End of spec.
