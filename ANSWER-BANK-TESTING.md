# Testing the answer bank

## Start it

Two terminals, both already configured. Nothing to set up.

```
cd "E:/AntiGravity/JobHub/server" && npm run start     # :3002
cd "E:/AntiGravity/JobHub"        && npm run dev       # :5173
```

Log in as yourself, click **Answer Bank** in the left nav.

⚠️ The local server writes to the **production Supabase database**. Your intake
is a real row on your real profile. That is fine, just know it is not a sandbox.

## Start over

```
cd "E:/AntiGravity/JobHub/server"
npm run reset:answer-bank kiron182@gmail.com
```

It shows you what it is about to delete and makes you retype the email. Add
`--yes` to skip the prompt. It only ever touches that person's intake, never
their resume or profile.

---

## What to actually test

### 1. It asks you about your own work, not generic questions
First screen should name a real employer from your resume. If it says "your last
job" the parser failed on your resume shape, and that matters.

### 2. The hints appear BEFORE you talk, not after
Three lines: reach for / how to say it / avoid. The **avoid** line should be
specific to that question, not the same on every screen.

### 3. Record works
Press record, talk for 30 seconds, stop. Text should appear in the box within a
few seconds. If the record button is missing, the AssemblyAI key did not load.

**Watch for**: names and jargon from your own resume coming back mangled. That
is the single most likely real-world failure.

### 4. It digs, and it digs at the right thing
Give it a deliberately weak answer first. Say something vague like *"yeah there
was a time at work that went badly, it was stressful"* and submit.

It should come back with **one** follow-up asking for the scene. Not three
questions. Not praise. Not a suggested answer.

Then answer properly and watch it move on to whatever is still missing.

| If you give it | It should ask about |
|---|---|
| Nothing much | Start again, from the top |
| No time or place | Where and when |
| Only "we" and "the team" | What **you** did specifically |
| No obstacle | What made it hard |
| No ending | How it turned out |

After three follow-ups it should let go and move on, even if the answer is still
thin. If it keeps hammering, that is a bug.

### 5. The tidy-up only removes
Compare the tidied text against **See exactly what you said**. It should have
dropped the ums and false starts and changed nothing else.

**The important one**: it must never add a number, a job title, or an ending you
did not say. If you see an amber warning saying the tidy-up was rejected, that
is the safety net working, not a bug. Tell me if you see it often.

### 6. Editing sticks
Change some words, confirm, click Next, come back. Your edit should be there.

### 7. It resumes
Close the tab mid-question. Reopen `/answer-bank`. It should put you back where
you were with everything you had confirmed still there.

### 8. Skip works
"Nothing for this one" should move on without banking an empty answer.

### 9. The download loads into the extension
Once you have a few confirmed, hit **Download**. Then in Chrome: extension
toolbar button → **Bank** → load `answer-bank.json`.

It should accept it. If it refuses, read the error, it names the slot that is
empty.

---

## Known, already flagged

Not bugs, do not chase them:

- **Your anchor employer may not be your most recent job.** It picks whichever
  employer has the most detail on the resume.
- **18 questions is too many for one sitting.** Deliberate for now; tell me the
  right number after you have felt it.
- **No `ethics` question unless your industry is health, finance or education.**

## What I want back

1. Where did it ask a stupid question?
2. Where did the follow-up feel like a coach, and where like a robot?
3. Did the transcription get your words right?
4. How long did five questions actually take?
