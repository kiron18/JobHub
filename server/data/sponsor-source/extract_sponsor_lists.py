"""
Build the merged sponsor registry from the two Home Affairs source releases.

Sources (both public, both in this folder):
  FA25-01-01229 - Accredited Temporary Resident (Skilled Employment) Sponsors, as at 15 Jan 2025
  DA25-08-00358 - Standard Business Sponsors (non-accredited), released 13 Oct 2025

The accredited PDF is a scan with a diagonal "Released by Department of Home Affairs"
watermark, so OCR interleaves watermark fragments between the real names. The standard
PDF is born-digital and extracts cleanly.

Output: sponsors_merged.json  [{ name, tier, source }]
        tier = "accredited" | "standard"

Usage: python extract_sponsor_lists.py
"""

import json
import re
from pathlib import Path

import fitz  # PyMuPDF

HERE = Path(__file__).parent
ACCREDITED_PDF = HERE / "FA25-01-01229_accredited-sponsors_2025-01-15.pdf"
STANDARD_PDF = HERE / "DA25-08-00358_standard-business-sponsors_2025-10-13.pdf"
OUT = HERE / "sponsors_merged.json"

# Watermark and boilerplate fragments the OCR scatters through the accredited scan.
NOISE_SUBSTRINGS = (
    "released by",
    "released py",
    "raleased by",
    "department of home affairs",
    "freedom of information",
    "dormrof frmormatron",
    "ep'artm",
    "notes:",
    "caveats:",
    "source: department",
    "this information is provided",
)

# A real company line has letters and enough length; OCR debris is short symbol soup.
COMPANY_HINT = re.compile(r"[A-Za-z]{3}")


def clean_lines(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    out: list[str] = []
    for page in doc:
        for raw in page.get_text().split("\n"):
            s = " ".join(raw.split())
            if not s:
                continue
            low = s.lower()
            if any(n in low for n in NOISE_SUBSTRINGS):
                continue
            if re.fullmatch(r"[\d\s\W_]+", s):  # page numbers, rules, symbol debris
                continue
            if len(s) < 4 or not COMPANY_HINT.search(s):
                continue
            out.append(s)
    doc.close()
    return out


def norm(name: str) -> str:
    """Match key: case, punctuation and legal-suffix spacing folded away."""
    s = name.upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\bPROPRIETARY\b", "PTY", s)
    s = re.sub(r"\bLIMITED\b", "LTD", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main() -> None:
    accredited = clean_lines(ACCREDITED_PDF)
    standard = clean_lines(STANDARD_PDF)
    print(f"accredited lines: {len(accredited)}")
    print(f"standard lines:   {len(standard)}")

    records: dict[str, dict] = {}

    # Standard first, accredited second so the accredited tier wins on collision.
    for name in standard:
        records[norm(name)] = {
            "name": name,
            "tier": "standard",
            "source": "DA25/08/00358 (2025-10-13)",
        }
    overlap = 0
    for name in accredited:
        key = norm(name)
        if key in records:
            overlap += 1
        records[key] = {
            "name": name,
            "tier": "accredited",
            "source": "FA25/01/01229 (2025-01-15)",
        }

    merged = sorted(records.values(), key=lambda r: r["name"].upper())
    n_acc = sum(1 for r in merged if r["tier"] == "accredited")

    OUT.write_text(json.dumps(merged, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"overlap (in both lists): {overlap}")
    print(f"merged unique: {len(merged)}  (accredited {n_acc}, standard {len(merged) - n_acc})")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
