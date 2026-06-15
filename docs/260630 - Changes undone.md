Features on staging (pushed to origin/staging)

  Company Intel (3 commits): 76a58ed 01a6762 e7bc9b2 b487a55
  - Perplexity sonar-pro research service
  - companyIntel JSON column in DB
  - Background fetch on job POST

  Analysis Result UX (2 commits): 7493a9f 14ad18d
  - Card redesign with inline checkbox bridging
  - Sticky apply bar, a11y fixes

  Sponsor model (1 commit): 25d509b
  - Sponsor model + SponsorConfidence enum in Prisma

  Build fix (1 commit): 7582e45
  - Removed unused React imports breaking production build

  NOT on staging — local only

  Nothing. Local master = origin/staging = local staging. All 7 commits above are on both.

  NOT yet pushed to origin/master (staging ahead of master)

  All 7 commits above. origin/master is 7 commits behind staging. That's the only gap.


Changes - 

"Browse roles on Seek" should be "Browse [roles relevant to candidate] on seek"

Once analysis is done we need to scroll down automatically to show users the results of the analysis 

Edit button on bridged gaps not working

Lets have apply now be a different co

After review let the screen scroll down to the review notes...

Add a copy instruction to use the edit feature to edit the document directly and copy/paste

Serper api is entered but i keep seeing this error in railway logs - serper] Search failed: Request failed with status code 400 - console log -Request: POST /analyze/cover-letter-personalisation Token injected
index-CxgukWFI.js:88 API Request: POST /research/company Token injected
index-CxgukWFI.js:88 API Request: GET /jobs Token injected
4index-CxgukWFI.js:88 API Request: POST /research/company Token injected

Can barely read this line -Top Fix

To further improve personalisation, the candidate could provide a specific example of how they would apply their skills and experience to enhance Worrells' brand presence and contribute to the National Marketing Committee, rather than just stating their ability to do so. -- needs a darker colour.

Lets remove the professional/warm/concise and tone bar for now

Can we implement a paragraph system for the cover letter. and also can the verify text be rendered red when edit mode is clicked...be very careful to ensure [verfiy] tags are never output to the final result but changing the colour will help idenitfy it
