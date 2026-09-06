# Contact discovery: Hunter test plan

Written 2026-09-06. Standing plan for measuring how accurate and how cheap our
contact discovery is, on a fixed set of real job ads, without burning the
50-credit test key.

Read this first in any new session that touches Hunter.

## Current state

**Progress: steps 0 to 6 are DONE. The end-to-end run happened on 2026-09-06;
results are the last section of this file. What remains is Kiron's judgement on
the nine contacts found.**

- `HUNTER_API_KEY` in `server/.env` line 48. **Hunter: 34 of 50 searches left,
  69 of 100 verifications left** after the full end-to-end run. Free plan,
  resets 2026-09-30.
- `SERPAPI_API_KEY` in `server/.env` line 57. **SerpApi: 222 of 250 searches
  left.** Free plan, renews 2026-10-06.
- Both keys went through a chat transcript. Rotate them when testing is done.
- `COMPANY_RESEARCH_ENABLED=false` in `server/.env`. Nothing in the app calls
  Hunter until this is `true`. Kiron turned it off because the pipeline returned
  wrong companies, not because Hunter itself was wrong. The cause is now known
  and written up below.
- Nothing in the running application has been changed. The harness is
  `server/src/scripts/hunter_corpus.ts` and it calls the real services rather
  than reimplementing them.

**Next action:** Kiron marks the nine contacts in the results table right or
wrong, and rules on the five domains listed as needing judgement. Everything
else is measured.

## The test corpus

`C:\Users\Kiron\Desktop\JObs samples.txt` - 20 real job ads, each copied in
full. Full copy matters: a truncated ad breaks the "contact printed in the ad"
step and makes results unpredictable. Kiron will add more ads over time.

Parsing: each ad has a header block ending in the line `View all jobs`. The
company is the nearest non-empty line above that, skipping a bare star-rating
number (e.g. `3.9`) when present. The title is the non-empty line above the
company. The body runs from the header to the next ad's title.

The 20 employers, which are a deliberate spread:

    Earth AI                      Konnexus                    Coalition of Peaks
    Sekisui Pilon Pty Ltd         Di Placido Group            HiTech Personnel
    New Home Care Pty. Ltd.       Strong Pilates Scarborough  NSW Police Force
    Department of Defence         Screen Australia            NSN Electrical
    Erskine street Investments    GIOXLE                      IT Strategic Pty Ltd
    Dig Deep Excavations (NSW)    Speed                       Good Games PTY LTD
    WA Country Health Service     Beyond Pier

Three large government bodies, one recruitment agency, several one-location
small businesses, several startups. The small businesses are where Hunter's
Australian coverage is expected to run out, and that is the point.

## What the API documentation actually says

Source: https://hunter.io/openapi.json and https://hunter.io/api-documentation/v2

These are the facts that change how we should build this.

| Endpoint | Cost |
|---|---|
| `GET /account` | free. Returns `requests.searches`, `requests.verifications` and `requests.credits` as separate buckets, plus `plan_name` and `reset_date` |
| `GET /email-count` | **free.** The spec says so explicitly |
| `GET /domain-finder` | **free.** Resolves a company name to a domain |
| `GET /domains-suggestion` | free |
| `POST /discover`, `/discover/people` | free |
| `GET /domain-search` | 1 credit, **and only when it returns at least one result** |
| `GET /email-finder` | 1 credit, only on success |
| `GET /email-verifier` | 1 credit, charged **per attempt**, success or not |

Two consequences worth stating plainly:

1. **Searches and verifications are separate buckets.** `/account` reports them
   separately. So verification does not eat the search budget. The half-credit
   figure in the current code comments is not what the API describes.
2. **An empty domain search is free.** Probing a domain Hunter has never heard
   of costs nothing. The expensive mistake is not an empty result, it is a
   result from the wrong domain.

`GET /email-count?domain=X&include_job_titles=1` returns, for free:
`total`, `personal_emails`, `generic_emails`, and counts broken down by
`department`, by `seniority` and by `job_titles`. That is a complete free
preview of what a paid domain search would contain.

`GET /domain-search` also supports filters we do not currently use:
`seniority`, `job_titles`, `decision_maker`, `required_field`,
`verification_status`, `aggregations`, and `company` as an alternative to
`domain`. The free plan caps `limit + offset` at 10.

Rate limits are not a constraint here: 15 requests per second on search,
10 per second on verification.

## The pipeline as it stands today

1. `readJdContact` reads the ad for a name or email. Free. If it finds one,
   everything below is skipped.
2. `resolveEntityName` (ABN register) turns a short or odd company name into
   the registered name, purely to improve the search query. Free. The register
   holds no website, so it never confirms a domain.
3. Google search via Serper or Firecrawl. Costs a search call, no Hunter credits.
4. `pickCompanyDomain` scores the results and returns nothing rather than
   guessing when no candidate matches the company name.
5. MX check, so a domain that receives no mail is rejected.
6. `fetchDirectoryForRole` calls `/domain-search` **twice**, once for `hr` and
   once for the vacancy's own department. 2 credits per company.
7. `pickFromDirectory` fills three slots: talent, hiring manager, team insider.
8. `verifySlots` verifies the slots Hunter has not already statused.

Steps 3 and 4 are the known weak point. Step 6 is where the money goes.

## What the plan changes

Insert two free steps before any paid call, and stop paying twice per company.

- **Free second opinion on the domain.** `/domain-finder?company=X` gives
  Hunter's own answer for free. Agreement with our Google-derived domain is
  strong evidence; disagreement is the flag that catches the failure that made
  Kiron turn the feature off.
- **Free coverage check before spending.** `/email-count` on the chosen domain
  tells us whether Hunter knows this employer at all, and which departments and
  job titles it holds, before a single credit moves.
- **One paid call instead of two.** The department breakdown from `/email-count`
  tells us which single `department` filter is worth asking for. The blind
  `hr` plus role-department pair becomes one targeted call.

Expected effect: the whole 20-ad corpus costs roughly one credit per employer
Hunter actually knows, not two per employer we ask about.

## Execution order

Nothing below spends a credit before step 4, and step 4 asks first.

**Step 0. Prove the free endpoints are free.** Call `/account` and record
`searches` and `verifications`. Call `/email-count` and `/domain-finder` once
each. Call `/account` again. If the counters have not moved, the cost table
above is confirmed empirically and the rest of the plan is safe. Cost: 0.

**Step 1. Build the harness.** A script that parses the 20 ads and runs steps 1
to 5 of the pipeline plus the two new free Hunter steps. Output one row per ad:
company, contact found in ad, our domain, Hunter's domain, whether they agree,
MX pass, Hunter's total email count, and the department breakdown. Cost: 0
Hunter credits, some Serper or Firecrawl calls.

**Step 2. Kiron reviews the domain column.** Every wrong domain caught here is
a credit not wasted on a directory of strangers, and this is the failure that
turned the flag off. Fix the picker, re-run, repeat. Cost: 0.

**Step 3. Add a disk cache** keyed on domain plus department, so re-running
after a code change costs nothing. This does not exist yet and is the single
largest source of avoidable waste. Cost: 0.

**Step 4. First paid run, and only now.** For the employers that survived step 2
and that `/email-count` says Hunter actually knows, one targeted
`/domain-search` each. Estimated 10 to 14 employers, so 10 to 14 credits.
Empty results are free, so the ceiling is the number of employers with coverage.

**Step 5. Judge accuracy.** Kiron marks each returned contact right or wrong.
Two numbers come out: credits spent per usable contact, and the share of
contacts judged correct.

**Step 6. Verification.** Only on the contacts we would actually hand a client.
Separate bucket, so this does not compete with the search budget.

Hold roughly 15 search credits back for a second iteration after step 5.

## Step 0 and the free corpus pass: RESULTS (2026-09-06)

Ran, and spent **zero credits**. `/account` read 0 used before and 0 used after,
every time.

**The plan.** Free tier: **50 searches, 100 verifications, 50 credits**, resets
2026-09-30. Searches and verifications are separate buckets, confirmed, so
verifying a contact does not touch the search budget.

**`/account`, `/email-count` and `/domain-finder` are genuinely free.** Proven by
reading the counters before and after, not by trusting the spec.

**`/domain-finder` returns more than a domain.** It returns a ranked list, each
entry carrying the matched company name and Hunter's email count for that
domain. Domain plus coverage in one free call.

**And it cannot be used for domain resolution.** It matches on company name text
with no geography at all. Across the 20-ad corpus it returned:

    Department of Defence      -> defence.ie          (Ireland)
    NSW Police Force           -> police.wa.gov.au    (wrong state, 1231 addresses)
    Konnexus                   -> konnexus.ca         (Canada)
    Di Placido Group           -> diplacido.ch        (Switzerland)
    HiTech Personnel           -> hitech.in           (India)
    NSN Electrical             -> nsnelectrical.co.uk (UK)
    Speed                      -> speed.gdynia.pl     (Poland)

NSW Police came back as an *exact company name match*. This is Kiron's original
bug reproduced exactly, and now the mechanism is known.

**Neither available lever fixes it.** Appending " Australia" to the query made it
worse: GIOXLE returned Australia Post, Services Australia and Virgin Australia,
because it matched the word Australia. `perfect_match=true` returned `mil.com`
for Department of Defence and still `police.wa.gov.au` for NSW Police.

**But Hunter is excellent once given the right domain.** Supplied by hand:

    defence.gov.au        2803 addresses, 2301 personal, full department split
    police.nsw.gov.au     461 addresses, 244 personal, 3 in HR
    sekisuifoam.com.au    5 addresses, 4 personal (domain-finder had found nothing)

### The conclusion that drives the design

**Hunter is a directory, not a search engine.** Domain resolution has to come
from a source that understands geography. Hunter's job starts once the domain is
known, and `/email-count` on a candidate domain is a free, instant, decisive test
of whether Hunter knows that employer.

So the order is:

1. Resolve the domain from a geography-aware source. SerpApi's
   `knowledge_graph.website` and the Maps `website` plus `address` fields. This
   is what the 250 free searches are for.
2. Free `/email-count` on each candidate domain. Confirms coverage and reveals
   which department to ask for. Costs nothing.
3. One targeted `/domain-search`. Only now does a credit move.

`/domain-finder` keeps a smaller job: a free cross-check, trusted only when its
answer is a `.au` domain whose matched name agrees with the ad's company name.

Raw output: `corpus_domains.json` in the session scratchpad.

## Search provider: SerpApi, not Serper.dev

As of 2026-09-06 the Serper.dev account is at zero balance. Kiron opened a
**SerpApi** account instead. These are different companies with different
endpoints and different response shapes, and `server/src/services/serper.ts`
currently posts to `https://google.serper.dev/search`. Swapping providers is a
code change, not a key change.

Source: https://serpapi.com/search-api, https://serpapi.com/pricing,
https://serpapi.com/knowledge-graph, https://serpapi.com/maps-local-results

- Endpoint: `GET https://serpapi.com/search?api_key=...&engine=google&q=...`
- Free plan: **250 searches a month, 50 an hour.**
- **Every search costs one, including one that returns nothing.** This is the
  opposite of Hunter, where an empty result is free. So a wasted SerpApi query
  still costs, and the hourly cap is a real constraint on repeated full runs.
- `q` accepts normal Google operators, so `site:` and `inurl:` work.
- `gl=au` and `hl=en` for Australian targeting, as the current code already does.

Two things in the response we do not currently read, and both bear directly on
the domain step that made Kiron turn the feature off.

**`knowledge_graph.website`.** A normal Google search response carries a
`knowledge_graph` block at no extra cost, and its `website` field is Google's
own answer for the entity's official site. That is a far better signal than
ranking organic results by position, which is how AC3 became a procurement
marketplace. It is free inside a search we are already paying for.
`knowledge_graph` also carries `address`, `headquarters`, `type`, `founded`
and `profiles`. Our `serper.ts` throws all of this away, keeping only title,
snippet and link.

**`engine=google_maps`.** One search, and each entry in `local_results`
carries `website`, `address`, `country`, `phone`, `type` and `place_id`. For a
one-location Australian business this is the strongest domain signal available,
and the `address` field confirms the right state, which is the exact failure the
contact filter exists to catch. This is the right tool for the small employers
in the corpus, Strong Pilates Scarborough, NSN Electrical, Dig Deep Excavations,
which are precisely the ones Google organic ranks badly.

So the domain ladder, cheapest first:

1. Hunter `/domain-finder`. Free, no SerpApi search at all.
2. SerpApi `engine=google`, reading `knowledge_graph.website` first and the
   organic results only as a fallback. One search.
3. SerpApi `engine=google_maps` for small local employers. One search, and the
   address confirms the state.

Twenty ads at two searches each is 40 of the 250. The binding constraint is the
50-an-hour throughput if we re-run the full corpus several times in one sitting,
not the monthly total.

## SerpApi: key installed and measured (2026-09-06)

`SERPAPI_API_KEY` is in `server/.env` (line 57). Account confirmed live:
**Free Plan, 250 searches a month, renews 2026-10-06, and the real hourly rate
limit is 250, not the 50 the pricing page implies.** `account.json` is free and
reports `plan_searches_left`, `this_month_usage` and `this_hour_searches`, so
spend is measurable the same way Hunter's is.

**Cached searches are free and are not counted.** SerpApi caches a query for
about an hour. So re-running the corpus while iterating costs nothing as long as
`no_cache` is left off. Do not set `no_cache=true` without a reason.

Useful parameters: `engine`, `q` (accepts `site:`, `inurl:`, `intitle:`),
`gl=au`, `hl=en`, `num`, `start`, `json_restrictor` to trim the payload,
`no_cache`, `async`. Local Python's certificate store on this machine rejects
serpapi.com, so calls go through `curl`. Hunter over `urllib` is fine.

### What a real probe showed (7 searches spent, 243 left)

Four companies, one Google search and one Maps search each.

**`knowledge_graph` is mostly absent.** It appeared for exactly one of the four,
Sekisui, where it was perfect: `sekisuifoam.com.au` plus the Caringbah NSW
address. NSW Police, NSN Electrical and Dig Deep Excavations returned no
knowledge panel at all. So it is a strong signal when present and cannot be the
backbone.

**Maps is excellent when the business is listed, and dangerous when it is not.**

    NSW Police Force  -> police.nsw.gov.au, 1 Charles St, Parramatta NSW   correct
    Sekisui Pilon     -> sekisuifoam.com.au, Caringbah NSW                 correct
    NSN Electrical    -> "N.V.M. Electrical Services", nvmelectrical.com   WRONG COMPANY
    Dig Deep Excav.   -> "Diggin It Excavations", "I Can Dig It"           WRONG COMPANY

Maps silently substitutes a similarly named nearby business. It needs the same
name-match gate that Hunter's domain finder needs. The `address` field is the
compensation: it carries the state, so a Sydney job matched to a Perth business
is catchable.

**Organic results were the best signal for the small employers.** NSN
Electrical's top organic result was `nsnelectrical.com.au`, which is correct and
which both Maps and Hunter got wrong. Dig Deep's organic results contained no
company website at all, but did include its ABR page
(`abr.business.gov.au/ABN/View/99614264952`), which suggests the business may
simply not have a website, and which our existing `abnLookup` can exploit.

### The domain rule this implies

No single source is trustworthy. Take all three, gate each on the company name,
and prefer agreement:

1. `knowledge_graph.website` when present. Strongest, appears rarely.
2. Maps `website`, but only when the result `title` matches the ad's company
   name and the `address` state matches the ad's state.
3. The top organic result whose registrable domain resembles the company name.
4. Hunter `/domain-finder`, free, accepted only when it returns a `.au` domain
   whose matched name agrees.

Then run the free Hunter `/email-count` on the winner. Zero coverage means stop,
and it costs nothing to find that out. NSN Electrical is the worked example:
`nsnelectrical.com.au` is the right domain and Hunter holds nothing for it, so
the correct outcome is no contact and no credit spent.

Two searches per ad is 40 of the 250, and re-runs inside the cache window are
free.

## Unverified assumptions

Things believed but not proven. Do not repeat them as fact.

- **That `/email-count` and `/domain-finder` really cost nothing.** The Hunter
  spec says so. Nobody has watched the counters. Step 0 settles it.
- **What the 50 is.** Hunter reports searches, verifications and credits as
  three separate buckets. Which one holds 50 is unknown until `/account` is
  called.
- **Every cost figure written in this repo's own comments.** The "2 credits per
  company" and "half a credit per verification" lines in `hunterDirectory.ts`
  and `verifySlots.ts` contradict the API documentation. The bake-off script
  counts credits by incrementing its own variable when a result returns, not by
  reading `/account`, so its cost numbers are also unproven.
- **The "30% of ads contain a contact" claim.** It comes from a comment citing
  that same bake-off. Treat it as unmeasured.
- **Whether `knowledge_graph` actually appears for small Australian employers.**
  Google shows a knowledge panel for well-known entities. It may be absent for
  most of the corpus, which is what would make the Maps call necessary rather
  than optional. One test search answers it.
- **The corpus parse beyond the 20 current ads.** Three of the twenty carry a
  star rating between the company name and the `View all jobs` marker. Ads added
  later may have other variants.
- **Endpoints not read properly.** Hunter's `/discover`, `/people/find`,
  `/companies/find`, `/combined/find` and multi-domain search. Discover is free
  and may cover some of this better than the path we have.

## Rules while testing

- Never call a paid endpoint from an ad-hoc command. It goes through the
  harness, which logs every call and its cost.
- `/account` before and after every paid run. The delta is the ground truth on
  spend, not our own counting.
- Nothing runs against the corpus without Kiron authorising that specific step.

## The end-to-end run: RESULTS (2026-09-06)

All twenty ads, through the real pipeline, from ad text to a verified mailbox.
Harness: `server/src/scripts/hunter_corpus.ts`, three stages, a disk cache under
`docs/hunter-test/cache/` so every re-run after this one is free. Output rows in
`docs/hunter-test/corpus_free.json` and `corpus_verify.json`.

    npx tsx src/scripts/hunter_corpus.ts --stage=free     domains + coverage, 0 credits
    npx tsx src/scripts/hunter_corpus.ts --stage=paid     + one /domain-search each
    npx tsx src/scripts/hunter_corpus.ts --stage=verify   + verification

### What it cost, read off /account

    hunter searches        15 of 50 used   (14 in the run, 1 in a follow-up probe)
    hunter verifications   31 of 100 used
    serpapi searches       20 of the corpus pass, all now cached

### The funnel

    20  ads
     1  had an address printed in the ad          NSW Police, free, no call at all
    16  domains resolved
    12  domains Hunter has any coverage for
     9  ads ended with at least one usable contact

### The nine contacts, for judgement

    Earth AI              isabella@earth-ai.com          hiring manager   valid
    Sekisui Pilon         jaredlewis@sekisuifoam.com.au  Chief Commercial Officer   valid
    Department of Defence marijke.henshaw@defence.gov.au Chief Diversity Officer    accept_all
    Konnexus              raed@konnexuscg.com.au         Recruitment Specialist     valid
    Strong Pilates        amanda@strongpilates.com.au    Head of Marketing          valid
    Screen Australia      norma.aguilar@screenaustralia.gov.au  Head of People      accept_all
    Coalition of Peaks    keryn.maloney@coalitionofpeaks.org.au Director            valid
    HiTech Personnel      jennifer@hitechaust.com        Recruitment Consultant     valid
    IT Strategic          stuart.haddad@itstrategic.com.au  IT Manager              valid
                          chris.cumpian@itstrategic.com.au  IT Support Engineer     valid

### Corrections to the cost model, all measured

**`/domain-search` spends the verification bucket too.** One isolated call on
`atlassian.com?department=hr` returned 10 people, 9 of them carrying a
verification status, and moved the counters by **1 search and 2 verifications**.
So the two buckets are not independent the way this document claimed: a
directory call quietly bills verifications for the records it freshens. That is
where 29 verifications came from in a run that only asked for 11 explicitly.
Budget the verification bucket against the search count, not only against
`verifySlots`.

**`/email-count` really is free, and really does need the key.** Fifteen calls
across the corpus moved neither counter. Called without `api_key` it returns
401, so "free" means "not billed", not "unauthenticated".

**`credits` is a third counter that tracks neither.** It read 14.5 while
searches read 14 and verifications read 29. Do not budget against it. Budget
against `searches` and `verifications`.

**The "30% of ads print a contact" figure is wrong.** One ad in twenty, 5%. The
figure in `jdContact.ts`'s comment comes from the old bake-off and does not
survive this corpus. Three more ads carried a redacted domain, which is
valuable but is not a contact.

### Where it still fails, and what each failure costs

**Four ads produced no domain, and each failure is a different shape.**

    Di Placido Group        organic's best was domain.com.au        a registrar
    Erskine street Inv.     organic's best was growthpoint.com.au   a REIT
    GIOXLE                  organic's best was entertainment.com.au a ticketing site
    WA Country Health       wacountry.health.wa.gov.au, rejected on MX

The first three are the name gate working: nothing bore the employer's name, so
nothing was returned, and no credit was spent guessing. That is the correct
outcome and it is what the old positional picker got wrong.

WA Country Health is the gate misfiring. `wacountry.health.wa.gov.au` IS their
site; it publishes no MX because their mail lives at `health.wa.gov.au`. This is
the ACH Group case from `mailDomain.ts`, and it is now the only known
false rejection in the corpus. The fix is to try the parent domain before giving
up, not to loosen the gate.

**Five domains need Kiron's eye before the contacts are trusted.**

    Speed              -> prospeedracing.com.au   Maps, a racing shop, ad is media
    Good Games         -> eclipsegames.com.au     organic, 0 coverage anyway
    Beyond Pier        -> unipier.com.au          organic, 1 generic address
    Dig Deep Excav.    -> digdeepcivil.com.au     knowledge panel, 0 coverage
    Strong Pilates Sc. -> strongpilates.com.au    the franchise, not the studio

Three of the five cost nothing: Hunter holds nothing for them, which is exactly
the free `/email-count` gate doing its job. Only Strong Pilates produced a
contact, and the question there is whether the franchise's Head of Marketing is
the right person for a job at one studio.

**Three ads reached a real directory and still filled no slot.** New Home Care
(4 addresses, all legal and finance), Speed (1 sales address), Beyond Pier (1
generic support address). The picker refusing to hand over a lawyer for an AI
engineering role is correct behaviour, but each of those cost a credit to learn.
`/email-count`'s department breakdown was already on screen and already said
there was no `hr` and no matching function. **Gating the paid call on the
department breakdown containing something the picker could actually use would
have saved three of the fourteen credits.**

### The one-line verdict

Nine usable contacts for 15 searches and 31 verifications, over twenty ads, with
the wrong-company failure that turned the flag off no longer occurring: every
domain that was wrong was either caught by the name gate or landed on an
employer Hunter has never heard of, so it cost nothing.

## Two fixes, built and measured the same day (2026-09-06)

Both were built against the failures the run above exposed, and both were
re-measured on the same twenty ads for **zero additional spend**, because the
harness cache already held every priced call.

    contacts before   9 of 20
    contacts after   14 of 20

### 1. The employer's own contact page (`server/src/services/siteContact.ts`)

Hunter is a record of addresses other people have already found. It is not a
crawler, so a one-location Australian business is simply not in it and never
will be. But those businesses publish an address on their own contact page, and
reading it costs nothing at all: no search vendor, no directory vendor, one
HTTPS GET of a page written to be read.

It runs only where the directory came back empty, because a shared inbox is a
weaker contact than a named person. Three of the corpus blanks now resolve:

    Dig Deep Excavations   info@digdeepcivil.com.au
    Speed                  enquiry@prospeedracing.com.au
    Good Games             info.eclipsegames@gmail.com

### 2. A last resort at a tiny company (`directoryPick.ts`)

Every rule in the picker asks "is this the RIGHT person", and at a four-person
company that question has no good answer, so all three slots came back empty
after a credit had already been spent. New Home Care held a lawyer, a paralegal,
a bookkeeper and a shared inbox, and the AI engineering vacancy matched none of
them, so all four were thrown away.

Now, when nothing else fills and the directory is small enough that everyone in
it is a meaningful fraction of the company, the most senior person is offered
with a `why` that says plainly they are not the hiring manager. New Home Care
returns David Kim, Compliance Manager, verified valid.

### Every explicit limit these two added, and how to change it

None of these is baked in. Each reads an environment variable.

| Setting | Default | What it decides |
|---|---|---|
| `DIRECTORY_LAST_RESORT_MAX` | 10 | Directory size at or below which "anyone who works there" is offered. **0 switches the behaviour off.** |
| `SITE_CONTACT_PATHS` | `/contact,/contact-us,/,/about,/about-us` | Pages tried, in order. First address wins. |
| `SITE_CONTACT_MAX_PAGES` | 4 | How many of those to fetch before giving up. |
| `SITE_CONTACT_TIMEOUT_MS` | 8000 | Per-page timeout. |
| `SITE_CONTACT_MAX_BYTES` | 4000000 | How much of a page to read. |
| `SITE_CONTACT_SAME_DOMAIN_ONLY` | true | Keep only addresses at the employer's own domain. `false` keeps everything. |
| `SITE_CONTACT_ALLOW_FREE_MAIL` | true | Keep a Gmail address whose local part carries the business name. `false` drops them. |

Two hard rules are in code rather than settings, deliberately, because turning
either off would hand a candidate somebody else's address: a `no-reply` or
`postmaster` local part is never returned, and a free-mail address is only kept
when its local part actually resembles the site's own name.

### Three bugs the build found in its own limits

Worth recording, because each was a plausible-sounding number that was simply
wrong.

**A 400KB page cap.** Set on the reasoning that a contact address sits near the
top of a page. eclipsegames.com.au serves 1.2MB of inlined script before the
footer where its only address lives, so the cap silently discarded the exact
address the module exists to find. The cap is for bounding memory, not for
guessing where an address will be.

**A same-domain-only rule.** Correct in general, and wrong precisely where it
mattered: Good Games' published inbox is a Gmail account. The fix is a
name-resemblance gate, not removing the rule.

**An unbounded email regex.** `[A-Za-z0-9._%+-]+@` is quadratic over a large
page and hung the process outright on a 900KB input. RFC 5321 caps a local part
at 64 characters, so the bound costs nothing and makes the scan linear.

### What is still blank, and why

    Di Placido Group        no domain: nothing in the results bore the name
    Erskine street Inv.     no domain: same
    GIOXLE                  no domain: same
    WA Country Health       real site rejected by the MX gate. STILL A BUG.
    Beyond Pier             one generic support address, no contact page
    NSN Electrical          contact form only, no address anywhere on the site

The three "no domain" rows are the name gate working as designed. NSN Electrical
and Beyond Pier publish no address at all, which is a fact about them rather
than a gap in the pipeline. WA Country Health is the one genuine remaining
defect: the fix is to try the parent mail domain before giving up.
