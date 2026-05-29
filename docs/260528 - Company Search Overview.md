That's everything I need — the app uses PostHog (src/lib/analytics.ts) with a clean trackX() helper 
  pattern, and the funnel is currently derived from profile state (no events/leads table yet). Here's 
  the design. I'll go section by section; tell me where to adjust.

  ---
  1. Architecture & data serving (the one real decision)

  Recommended: serve from Postgres, enforce the gate server-side.

  Seed the sponsors_enriched.json into a new Prisma Sponsor table (one-time seed script, re-runnable).   A public API does the search/filtering and omits the contact links (website, careersUrl) until the 
  visitor has given an email. The frontend never receives locked data it shouldn't have.

  I rejected the simpler "ship the JSON to the browser, filter client-side" approach: it makes the    
  email gate cosmetic (anyone reads the locked links in the network tab), which kills the conversion  
  mechanic. The data itself isn't secret — these are public company sites — so this is a conversion   
  gate, not a security boundary, but it still has to actually withhold the payload to work.

  Endpoints:
  - GET /api/sponsors/search?q=&industry=&location=&page= → { total, results[] }. Results include     
  name/industry/location/hiringProfile always; website/careersUrl only when unlocked.
  - POST /api/sponsors/unlock { email } → stores a SponsorLead, sets a signed httpOnly cookie that    
  unlocks links on subsequent searches.
  - Logged-in users skip the gate automatically (we already have their email).

  Does this section look right before I detail the rest?

  ---
  2. The page (/visa-sponsors, public route)

  Slots in beside /pricing and /legal in App.tsx. Styled with the landing tokens.ts (petrol/gold/warm)   so it reads as a JobHub marketing surface, not the in-app dashboard.

  Layout, top to bottom: hero (headline + one-line value + search bar) → filter chips (industry,      
  location, "high-confidence only") → results grid of company cards → infinite scroll / "load more" → 
  footer CTA into JobHub.

  Each company card: clean name, industry tag, location, the one-line hiring profile, and two actions 
  — Visit site / Careers page (locked until email) and Write my outreach email (locked until
  trial/paid, shows preview).

  3. The three tiers in the UI

  - Anonymous: full search + see every match (name/industry/location/profile) + live count ("47       
  sponsors hiring in Healthcare near you"). Contact links show as a locked pill → clicking opens the  
  email-capture modal. (I picked "see matches, links locked" — highest-intent capture, still
  SEO-indexable, gift-before-ask.)
  - Email given (cookie set): contact links revealed everywhere. The directory is now fully usable for   manual outreach. Lead captured.
  - Trial / paid: the "Write my outreach email" button is live — routes them into your existing       
  generation flow with the company pre-filled. For everyone else it shows a blurred preview of a      
  sample email + "Start your trial to unlock." Same wall as the rest of the app.

  4. Tracking (PostHog)

  New helpers in analytics.ts, mirroring the existing trackLanding* block:
  sponsor_directory_viewed, sponsor_search_performed (q, filters, result_count),
  sponsor_email_gate_shown, sponsor_email_captured, sponsor_links_unlocked,
  sponsor_outreach_locked_clicked, sponsor_trial_cta_clicked. That gives you the full funnel: view →  
  search → gate → email → trial click.

  5. Copy

  I'll write the load-bearing persuasive copy in the spec — hero headline + subhead, search
  placeholder, the email-gate modal, the locked-outreach preview, and the CTA buttons — since that's  
  the part where wording drives conversion. I'll leave the long-form / filler (FAQ, footer legal      
  blurb, meta description) marked as [DeepSeek/you] placeholders so you're not stuck with my version  
  of everything.

  ---
  Two small flags for the spec: (a) some careersUrl values are guessed and wrong (one points at       
  abr.business.gov.au/careers) — I'll have the card fall back to the website link when confidence is  
  low and hide obviously-broken career URLs; (b) Pinecone semantic search stays out of v1 (you chose  
  keyword+filters) but I'll note it as the natural v2.
