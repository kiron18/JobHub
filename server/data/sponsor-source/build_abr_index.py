"""
Look up our sponsors in the ABN Bulk Extract to get state, postcode, ABN and GST.

Source: https://data.gov.au/data/dataset/abn-bulk-extract  (CC-BY 3.0 AU, free)
  Part 1: public_split_1_10.zip
  Part 2: public_split_11_20.zip

The extract holds ~11M businesses. Indexing all of them into a dict costs tens of
gigabytes of RAM, so we invert the problem: load our ~36k sponsor names first, then
stream the ABR and keep only the records that match one of them. Peak memory stays
in the tens of megabytes and the whole thing is one pass over the data.

Matching is two-tier:
  exact  normalised name is identical
  loose  identical once legal suffixes (PTY, LTD, GROUP, AUSTRALIA...) are stripped.
         Loose hits that resolve to more than one distinct ABN are discarded rather
         than guessed at, so we never staple the wrong ABN to a sponsor.

Output: abr_matches.json  { sponsor_name_key: {abn, state, postcode, entityType,
                                               abnActive, gst, matched, abrName} }

Usage: python build_abr_index.py <dir-with-the-two-zips>
"""

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

HERE = Path(__file__).parent
MERGED = HERE / "sponsors_merged.json"
ENRICHED = HERE.parent / "sponsors_enriched.json"
OUT = HERE / "abr_matches.json"

SUFFIXES = re.compile(
    r"\b(PTY|LTD|LIMITED|INC|INCORPORATED|CO|COMPANY|GROUP|AUSTRALIA|AUST|THE)\b"
)


def norm(name: str) -> str:
    s = name.upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\bPROPRIETARY\b", "PTY", s)
    s = re.sub(r"\bLIMITED\b", "LTD", s)
    return re.sub(r"\s+", " ", s).strip()


def loose(key: str) -> str:
    return re.sub(r"\s+", " ", SUFFIXES.sub(" ", key)).strip()


def load_wanted() -> tuple[set[str], dict[str, set[str]]]:
    """Our sponsor names, as an exact-key set and a loose-key -> exact-keys map."""
    exact: set[str] = set()
    for r in json.loads(MERGED.read_text(encoding="utf-8")):
        exact.add(norm(r["name"]))
    for r in json.loads(ENRICHED.read_text(encoding="utf-8")):
        exact.add(norm(r["cleanName"]))

    loose_map: dict[str, set[str]] = {}
    for key in exact:
        lk = loose(key)
        if len(lk) >= 5:  # too-short stems match half the register
            loose_map.setdefault(lk, set()).add(key)
    return exact, loose_map


def text_of(el, path: str) -> str | None:
    if el is None:
        return None
    found = el.find(path)
    return found.text.strip() if found is not None and found.text else None


def read_record(abr) -> tuple[list[str], dict] | None:
    abn_el = abr.find("ABN")
    if abn_el is None or not abn_el.text:
        return None

    entity = abr.find("MainEntity")
    if entity is not None:
        primary = text_of(entity, "NonIndividualName/NonIndividualNameText")
    else:
        entity = abr.find("LegalEntity")
        if entity is None:
            return None
        given = " ".join(
            t.text.strip() for t in entity.findall("IndividualName/GivenName") if t.text
        )
        family = text_of(entity, "IndividualName/FamilyName") or ""
        primary = f"{family}, {given}".strip(", ") or None
    if not primary:
        return None

    addr = entity.find("BusinessAddress/AddressDetails")
    gst_el = abr.find("GST")

    record = {
        "abn": abn_el.text.strip(),
        "abrName": primary,
        "state": text_of(addr, "State"),
        "postcode": text_of(addr, "Postcode"),
        "entityType": text_of(abr, "EntityType/EntityTypeText"),
        "abnActive": abn_el.get("status") == "ACT",
        "gst": gst_el is not None and gst_el.get("status") == "ACT",
    }

    names = [primary]
    for other in abr.findall("OtherEntity/NonIndividualName/NonIndividualNameText"):
        if other.text:
            names.append(other.text.strip())
    return names, record


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    zips = sorted(src.glob("*.zip"))
    if not zips:
        sys.exit(f"no zips found in {src}")

    wanted, loose_map = load_wanted()
    print(f"looking up {len(wanted):,} sponsor names ({len(loose_map):,} loose stems)")

    exact_hits: dict[str, dict] = {}
    # loose candidates: sponsor key -> {abn: record}. More than one ABN means ambiguous.
    loose_hits: dict[str, dict[str, dict]] = {}
    scanned = 0

    for zpath in zips:
        with zipfile.ZipFile(zpath) as z:
            for member in (m for m in z.namelist() if m.lower().endswith(".xml")):
                with z.open(member) as fh:
                    for _, abr in ET.iterparse(fh, events=("end",)):
                        if abr.tag != "ABR":
                            continue
                        scanned += 1
                        parsed = read_record(abr)
                        abr.clear()
                        if not parsed:
                            continue
                        names, record = parsed
                        for n in names:
                            key = norm(n)
                            if key in wanted:
                                prev = exact_hits.get(key)
                                # An active ABN beats a cancelled one.
                                if prev is None or (
                                    record["abnActive"] and not prev["abnActive"]
                                ):
                                    exact_hits[key] = record
                                continue
                            for sk in loose_map.get(loose(key), ()):
                                loose_hits.setdefault(sk, {})[record["abn"]] = record
                print(
                    f"  {member}: scanned {scanned:,} | "
                    f"exact {len(exact_hits):,} | loose {len(loose_hits):,}"
                )

    out: dict[str, dict] = {}
    for key, rec in exact_hits.items():
        out[key] = {**rec, "matched": "exact"}

    ambiguous = 0
    for key, by_abn in loose_hits.items():
        if key in out:
            continue
        if len(by_abn) != 1:
            ambiguous += 1
            continue
        out[key] = {**next(iter(by_abn.values())), "matched": "loose"}

    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    n_loose = sum(1 for v in out.values() if v["matched"] == "loose")
    print(f"\nscanned {scanned:,} ABR records")
    print(f"matched {len(out):,} of {len(wanted):,} sponsors "
          f"({len(out) / len(wanted):.0%})")
    print(f"  exact {len(out) - n_loose:,} | loose {n_loose:,} | "
          f"ambiguous-loose discarded {ambiguous:,}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
