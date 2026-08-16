# AGC Form Assistant

Reads every question on a job application form and answers it from the candidate's own answer bank. It never submits anything, and the only thing it ever writes into is the one box whose **Insert** button was pressed.

No network calls, no API key, no model. All of it runs on the machine.

## Install (once)

1. Chrome, go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked**, pick this folder (`JobHub/extension`)
4. Pin "AGC Form Assistant" to the toolbar
5. Click the toolbar button, then **Bank**, and load the candidate's bank. **Load the example bank** shows the shape of one.

## Use

Open an application page, click the toolbar button. A panel opens on the right with every question and the answer for it.

Per question you get the answer text (editable in place), its word count against the form's limit, which story it came from, **Copy**, **Insert**, and **Other** to swap to a runner-up. Using an answer is remembered, so the next form asking the same question opens with that answer already chosen, no matter which employer it belongs to.

Colour down the left edge: blue is an open-ended question, green is a plain fact answered from the profile, orange is either a loose match worth reading or a field no label could be read for.

## The three parts

| | what it does |
|---|---|
| `reader/` | reads the form. Accessible-name rules first, container text as a fallback, iframes included, cookie banners and honeypots stripped |
| `matcher/` | turns a question into an answer. Shape (what form of answer) and theme (which material), then the bank ranked against it |
| `intake/` | turns a resume into the interview that builds the bank in the first place |

`background.js` is only storage and messaging. Everything that decides anything is a plain ES module under `matcher/`, which is why the whole path is testable with no browser.

## The flow, end to end

```
resume.txt
   -> node intake/plan.mjs resume.txt --industry finance --scaffold bank.json
   -> ask the questions on a call, transcribe into "raw", cut the four variants
   -> load bank.json into the extension (Bank page)
   -> click the toolbar button on any application form
   -> answers, sized to the box, with the employer's name written in
```

The scaffold will not load until its slots have text in them. That is deliberate: a bank that loads empty answers forms with nothing and looks like it worked.

## What it will not do

- **Guess a working-rights answer.** A yes/no option is only ever suggested from an explicit `hasWorkRights` / `requiresSponsorship` boolean in the bank. Without one it shows the words and leaves the choice alone.
- **Write an answer.** The matcher only ever reaches for text a human already wrote and approved.
- **Fill the commodity fields for you automatically.** Name, email and phone are answered because they are on the sheet anyway, but nothing is written until Insert is pressed.

## Test

```
node test.mjs            # all 8 suites
node test.mjs --verbose  # with each suite's own output
```

`e2e.test.mjs` is the one to read first: a careers page with a Greenhouse form in a cross-origin iframe, the real service worker, the real content script, ending with an assertion that the text landed in the actual `<textarea>`.

`package.test.mjs` catches the mistakes Chrome only reports after you have loaded the folder, the sharpest being an `import` at the top of `capture.js`, which node accepts and a content script does not.

## Notes

- Permissions are `activeTab`, `scripting` and `storage`. It has no access to any page until the button is clicked, and no host permissions at all.
- The bank lives in `chrome.storage.local` on that machine. **Download bank** on the options page takes it away again, with everything it has remembered folded in.
- Chrome loads this folder as-is, so the `*.test.mjs` files ship with it. Harmless while it is loaded unpacked; strip them if it is ever packed for the store.
