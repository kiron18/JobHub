# The shape of JobHub

Kiron's spec, 2026-09-02. This is the target. It supersedes the nav that is
currently on `staging`, and it is what page redesigns should be built against.

Nothing here is a suggestion from an agent. Where a decision is still open it
says so explicitly under [Open questions](#open-questions).

---

## The sidebar

```
  +  New application
  +  New outreach
  ─────────────────
     Your tracker
     Your profile
  ─────────────────
     Leaderboard
     Templates
     Interview prep          (name unresolved, see Open questions)
     Visa sponsors
```

Both top items use a plus icon. They are the two things you do.

`Networking` is removed. It was the LinkedIn page under another name, and the
one thing anybody goes there to do is outreach, which now has its own entry.

`Your documents` is removed. Documents no longer live in a flat library; they
live inside the job they were written for.

---

## New application

This is `/`, the default page. Signing in lands you here, and it is where you
return between applications.

The flow, in order:

1. Check eligibility
2. Generate resume
3. Generate cover letter
4. Generate selection criteria
5. Download the documents
6. Send the follow-up letter

Home stays single purpose. Counts, charts and history belong to Your tracker,
not here.

---

## New outreach

Goes straight to the LinkedIn outreach page. Tab order on that page:

1. **Outreach** (first, and the default)
2. **Profile**

There is no Tracker tab. Outreach history moves into Your tracker.

Follow-up reminders still surface **on the outreach page itself**, at the three
day and seven day marks, so the prompt to chase a reply appears where you would
act on it rather than in a list you have to remember to open.

---

## Your tracker

Two trackers in one place: applications and LinkedIn outreach.

**Everything is stored against the job.** One card per job. Open the Canva card
and you get the resume you sent them, the cover letter, the selection criteria,
and the job description itself. Open an outreach entry and you get the message
you sent and when you sent it.

That activity feeds:

- the contribution grid (the GitHub squares), covering applications **and** outreach
- the overview numbers: applications submitted, interviews reached, and so on

---

## Your profile

This is the resume bank, and it is "about you".

Edits made here are the source of truth. Change something in the bank and it is
fixed for everything generated afterwards, including the baseline resume.

---

## Leaderboard, Templates, Interview prep, Visa sponsors

The bottom group. Things you go and fetch from rather than places you work.

The leaderboard comes back once Kiron has settled the streak logic. It is not
to be re-enabled before then.

---

## Open questions

1. **Interview prep is a name that is already taken.** `/interview/:jobId`
   is per-job interview prep, generated against one specific ad, with a stage
   (recruiter screen, hiring manager, panel, technical, final). The Answer Bank
   is a different thing: one library of STAR stories, built once and reused.
   Giving both the same name repeats the Profile and Tracker collisions we just
   spent two passes removing.

2. **Two things called Profile.** The sidebar has `Your profile`, and the
   LinkedIn page's second tab is `Profile`. Renaming the tab to
   `LinkedIn profile` costs nothing and it is literally what it is.

3. **Local Experience has nowhere to live.** It is a tab on the LinkedIn page
   today, and there is also a separate `/local-experience-playbook` page. With
   Networking gone from the sidebar, neither has an entry point.

4. **Is the follow-up letter a step or a reminder?** It is listed as step 6 of
   the apply flow, but it is sent days later, so it cannot be completed in the
   same sitting. Likely answer: the apply flow drafts it, the tracker reminds
   you to send it.

5. **Orphans.** `/skipped` and `/mindset` have no entry point in this shape.
   Keep, fold in, or drop.
