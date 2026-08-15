# Sponsor registry sources

Every Australian business approved to sponsor a work visa, straight from the primary
source. No scraping of any competitor's site.

## Where the data comes from

Home Affairs does not publish the sponsor register as an open dataset. It releases it
on request, and past requesters publish what they receive on righttoknow.org.au. Two
releases together cover the whole register.

| File | Release | Covers | Rows |
|---|---|---|---|
| `FA25-01-01229_accredited-sponsors_2025-01-15.pdf` | FOI FA25/01/01229, as at 15 Jan 2025 | Accredited sponsors | ~4,058 |
| `DA25-08-00358_standard-business-sponsors_2025-10-13.pdf` | Data request DA25/08/00358, released 13 Oct 2025 | Standard Business Sponsors, non-accredited | 35,495 |

Both PDFs are gitignored because of their size. Re-download:

- Accredited: <https://www.workvisalawyers.com.au/images/Approved-Sponsor-List-2025.pdf>
- Standard: <https://www.righttoknow.org.au/request/request_for_list_of_approved_sta>
  (attachment `da 250800358 document released.pdf` on that thread)

The standard list is born-digital and extracts cleanly. The accredited list is a
scan with a diagonal watermark, so OCR mangles part of it. We do not rely on that
OCR: `../sponsors_enriched.json` is an already-cleaned rendering of the same
accredited list and is used as the accredited tier instead.

**A fresher or richer cut costs about $30.** Home Affairs charges a flat fee for a
data access request (that is what the $30 invoice on the DA25/08/00358 thread was).
A request worded to include ABN, state and ANZSIC industry would remove our need to
infer industry at all.

## The tier tag

The two lists are the tagging system's backbone:

- **`accredited`** (~3.9k) gets priority visa processing from Home Affairs. For a job
  seeker this is the strongest "apply here first" signal on the page.
- **`standard`** (~33k) can sponsor, but without the priority lane.

No competitor surfaces this split as a filter.

## ABR enrichment (free)

State, postcode, ABN, entity type and GST status come from the **ABN Bulk Extract**
(Australian Business Register, CC-BY 3.0 AU, free, no API key, ~1GB in two zips):
<https://data.gov.au/data/dataset/abn-bulk-extract>

The ABR carries **no** industry classification, so industry stays inferred until we
buy the richer Home Affairs cut.

## Pipeline

```bash
# 1. names out of the two PDFs  ->  sponsors_merged.json
python extract_sponsor_lists.py

# 2. look our names up in the ABR  ->  abr_matches.json
#    (point it at the folder holding the two ~500MB zips)
python build_abr_index.py /path/to/abr-zips

# 3. join everything  ->  sponsor_registry.json
python build_registry.py

# 4. load it
npx tsx src/scripts/seed_sponsors.ts data/sponsor-source/sponsor_registry.json
```

Step 2 streams the ABR rather than indexing it. The extract holds ~11M businesses,
so building a dict of all of them costs tens of GB of RAM; loading our 37k names
first and keeping only what matches keeps it under 50MB.

Loose matching (identical once PTY/LTD/GROUP/AUSTRALIA are stripped) is accepted only
when it resolves to a single ABN. Ambiguous stems are dropped rather than guessed, so
a sponsor never gets the wrong company's ABN attached.

## Known improvement: trading names for trusts

Roughly one in six standard-tier sponsors is registered as `THE TRUSTEE FOR <X> TRUST`
or as a family partnership (`F GOLINO & T GOLINO`). Those names carry no industry
signal, so `classify_sponsor_industries.ts` correctly returns Unknown for them, and
they end up with no industry facet.

The ABR usually *does* hold a trading or business name for those ABNs, under
`OtherEntity/NonIndividualName`. Feeding that name to the classifier instead of the
trust name would likely recover a few thousand rows. `build_abr_index.py` already
reads those names for matching but only keeps the entity's primary name in its
output, so this needs one extra field and a re-scan.

Worth doing before paying for a wider Home Affairs cut, since it is free.

## The `confidence` field is gone

`sponsors_enriched.json` still carries a `confidence` of high/medium/low. It was an
LLM guess from when the directory was ~4k rows, and the public page exposed it as a
"high confidence only" filter.

Every row in this registry is a confirmed sponsor on a government list, so a
confidence rating read as if we doubted whether the company sponsors at all. It was
dropped in migration `20260815000001_sponsor_tier_replaces_confidence` and the filter
chip is now "Accredited sponsors only", which is a fact rather than a guess.

The `confidence` key in `sponsors_enriched.json` is now ignored on import.
