"""
Build the final sponsor registry: every Home Affairs sponsor, tiered and ABR-enriched.

Inputs
  ../sponsors_enriched.json   existing ~3.9k accredited sponsors, already cleaned and
                              enriched. Used as the ACCREDITED tier, because it is a
                              cleaner rendering of the accredited list than anything we
                              can OCR back out of the scanned FOI PDF.
  sponsors_merged.json        extract_sponsor_lists.py output. We take only its
                              "standard" tier, which came from a born-digital PDF and
                              extracts cleanly.
  abr_matches.json            build_abr_index.py output. Free ABR data, already keyed
                              by our own normalised sponsor name.

Output
  sponsor_registry.json       what seed_sponsors.ts loads.

industry / website / careersUrl carry over for the accredited tier where we already
have them, and stay null for the standard tier. Those are the enrichment step.

Usage: python build_registry.py
"""

import json
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
ENRICHED = HERE.parent / "sponsors_enriched.json"
MERGED = HERE / "sponsors_merged.json"
MATCHES = HERE / "abr_matches.json"
OUT = HERE / "sponsor_registry.json"


def norm(name: str) -> str:
    """Match key. Must stay identical to build_abr_index.py."""
    s = name.upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\bPROPRIETARY\b", "PTY", s)
    s = re.sub(r"\bLIMITED\b", "LTD", s)
    return re.sub(r"\s+", " ", s).strip()


def is_junk(name: str) -> bool:
    """
    Fragments that are not company names.

    Two sources. The accredited PDF is a scan whose diagonal watermark the OCR emits
    as pseudo-names ('"_;', '(1] _JJ', '=Ml'); some even matched a real ABN by
    coincidence. Both PDFs also wrap long names across lines, leaving orphan tails
    like '(Operations)', '(Qld)' and '& DAVID CAVALLARO'.

    Rules: at least three letters, and it must begin with a letter or a digit.

    The leading-character test is deliberately Unicode-aware rather than [A-Za-z0-9].
    'Össur' is a real prosthetics manufacturer on the accredited list, and an ASCII
    class would delete it along with the junk.
    """
    letters = re.findall(r"[^\W\d_]", name, flags=re.UNICODE)
    if len(letters) < 3:
        return True
    return re.match(r"^[^\W_]", name, flags=re.UNICODE) is None


def clean_industry(value: str | None) -> str | None:
    """
    Drop the old free-text industry values.

    The previous enrichment pass invented its own labels, so the same sector arrived
    as 'Financial Services' and 'Finance', or 'Transportation' and
    'Transportation / Logistics', plus 339 literal 'Unknown's. Mixing that with the
    19 ANZSIC divisions the classifier now emits would leave the filter dropdown with
    two competing taxonomies. We keep the old value only as a hint for the
    classifier, under industryHint, and let it re-decide.
    """
    if not value:
        return None
    v = value.strip()
    return None if not v or v.lower() == "unknown" else v


def pick_trading_name(legal: str, trading: list[str]) -> str | None:
    """
    The name the business actually trades under, when it differs from the legal one.

    Matters for the ~3.4k sponsors registered as 'THE TRUSTEE FOR <X> TRUST' or as a
    family partnership. Those legal names say nothing about what the business does, so
    the industry classifier can only answer Unknown. The ABR usually also holds the
    name on their door, which is the one worth classifying.

    Returns None when the trading name adds nothing (same as the legal name, or junk).
    """
    legal_key = norm(legal)
    for name in trading:
        if is_junk(name):
            continue
        key = norm(name)
        if not key or key == legal_key:
            continue
        # A trading name that is just the legal name minus 'THE TRUSTEE FOR' is no
        # more informative than what we started with.
        if key in legal_key or legal_key in key:
            continue
        return name
    return None


def main() -> None:
    abr = json.loads(MATCHES.read_text(encoding="utf-8"))

    # Carry over industries from a previous run. Classification costs money, so a
    # rebuild must never silently throw away a pass that has already been paid for.
    previous: dict[str, str] = {}
    if OUT.exists():
        for r in json.loads(OUT.read_text(encoding="utf-8")):
            if r.get("industry"):
                previous[norm(r["name"])] = r["industry"]
        print(f"carrying over {len(previous):,} industries from the existing registry")

    rows: dict[str, dict] = {}

    # Standard tier first, accredited second, so accredited wins any collision.
    for r in json.loads(MERGED.read_text(encoding="utf-8")):
        if r["tier"] != "standard":
            continue
        rows[norm(r["name"])] = {
            "name": r["name"],
            "tier": "standard",
            "industry": None,
            "industryHint": None,
            "hiringProfile": None,
            "website": None,
            "careersUrl": None,
            "careersSearchUrl": None,
            "locations": None,
        }

    for r in json.loads(ENRICHED.read_text(encoding="utf-8")):
        rows[norm(r["cleanName"])] = {
            "name": r["cleanName"],
            "rawName": r.get("rawName"),
            "tier": "accredited",
            # Left null on purpose so the classifier assigns an ANZSIC division to
            # these rows too, using the old label below as a hint.
            "industry": None,
            "industryHint": clean_industry(r.get("industry")),
            "hiringProfile": (r.get("hiringProfile") or "").strip() or None,
            "website": r.get("website"),
            "careersUrl": r.get("careersUrl"),
            "careersSearchUrl": r.get("careersSearchUrl"),
            "locations": r.get("locations") or None,
        }

    dropped = [k for k, v in rows.items() if is_junk(v["name"])]
    for k in dropped:
        del rows[k]

    stats: Counter = Counter()
    out = []
    for key, row in rows.items():
        hit = abr.get(key)
        trading = pick_trading_name(row["name"], (hit or {}).get("tradingNames") or [])
        row.update(
            {
                "abn": hit["abn"] if hit else None,
                "state": hit["state"] if hit else None,
                "postcode": hit["postcode"] if hit else None,
                "entityType": hit["entityType"] if hit else None,
                "abnActive": hit["abnActive"] if hit else None,
                "gst": hit["gst"] if hit else None,
                "abrMatch": hit["matched"] if hit else "none",
                "tradingName": trading,
            }
        )
        if row["industry"] is None:
            row["industry"] = previous.get(key)
        if trading:
            stats["has_trading_name"] += 1
            if not row["industry"]:
                stats["unclassified_with_trading_name"] += 1
        stats[row["abrMatch"]] += 1
        stats[row["tier"]] += 1
        if hit and hit["state"]:
            stats[f"state:{hit['state']}"] += 1
        out.append(row)

    out.sort(key=lambda r: r["name"].upper())
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")

    total = len(out)
    matched = stats["exact"] + stats["loose"]
    print(f"dropped {len(dropped)} OCR-debris names from the accredited scan")
    print(f"registry rows: {total:,}")
    print(f"  accredited {stats['accredited']:,} | standard {stats['standard']:,}")
    print(f"  ABR matched: {matched:,} ({matched / total:.0%}) "
          f"[exact {stats['exact']:,} | loose {stats['loose']:,} | none {stats['none']:,}]")
    classified = sum(1 for r in out if r["industry"])
    print(f"  industry set on {classified:,}; {total - classified:,} still blank")
    print(f"  trading name found for {stats['has_trading_name']:,}, "
          f"of which {stats['unclassified_with_trading_name']:,} are still unclassified "
          f"(these are what the next classify pass can recover)")
    print("  by state:")
    for st, n in sorted(
        ((k.split(":", 1)[1], v) for k, v in stats.items() if k.startswith("state:")),
        key=lambda x: -x[1],
    ):
        print(f"    {st:6} {n:,}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
