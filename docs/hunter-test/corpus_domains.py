"""Free pass over the whole corpus: company name -> domain -> Hunter coverage.

Uses only /domain-finder and /email-count, both proven free in step 0.
Prints a table for Kiron to check the domain column, and re-reads /account at
the end to prove nothing was charged.
"""
import json, re, sys, time, urllib.parse, urllib.request

ENV = r"E:\AntiGravity\JobHub\server\.env"
CORPUS = r"C:\Users\Kiron\Desktop\JObs samples.txt"
OUT = "corpus_domains.json"

KEY = next(l.split("=", 1)[1].strip()
           for l in open(ENV, encoding="utf-8", errors="replace").read().splitlines()
           if l.startswith("HUNTER_API_KEY="))


def get(path, **params):
    params["api_key"] = KEY
    url = "https://api.hunter.io/v2/" + path + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(2 + attempt * 3); continue
            try:
                return json.load(e)
            except Exception:
                return {"errors": [{"details": f"HTTP {e.code}"}]}
        except Exception as ex:
            if attempt < 2:
                time.sleep(2); continue
            return {"errors": [{"details": str(ex)}]}


# ---- parse the corpus ------------------------------------------------------
lines = open(CORPUS, encoding="utf-8", errors="replace").read().splitlines()
RATING = re.compile(r"^\d(\.\d)?$")

jobs = []
marks = [i for i, l in enumerate(lines) if l.strip() == "View all jobs"]
for m in marks:
    # company: nearest non-empty line above, skipping a bare star rating
    i = m - 1
    while i >= 0 and (not lines[i].strip() or RATING.match(lines[i].strip())):
        i -= 1
    company = lines[i].strip()
    # title: next non-empty line above the company
    j = i - 1
    while j >= 0 and not lines[j].strip():
        j -= 1
    title = lines[j].strip() if j >= 0 else ""
    jobs.append({"title": title, "company": company, "header_line": m + 1})

# body: from this marker to the next job's title line
for n, job in enumerate(jobs):
    start = job["header_line"]
    end = (marks[n + 1] - 6) if n + 1 < len(marks) else len(lines)
    job["body_chars"] = len("\n".join(lines[start:end]))

print(f"parsed {len(jobs)} ads\n")


def norm(s):
    s = s.lower()
    s = re.sub(r"\b(pty\.?|ltd\.?|limited|inc\.?|group|australia|au|nsw|vic|qld|wa|sa|the)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)


acct_before = get("account")["data"]["requests"]

rows = []
for job in jobs:
    c = job["company"]
    df = get("domain-finder", company=c, limit=5)
    cands = df.get("data") or []
    if isinstance(cands, dict):
        cands = [cands]
    err = (df.get("errors") or [{}])[0].get("details")

    target = norm(c)
    best, why = None, ""
    for cand in cands:
        cn = norm(cand.get("company_name") or "")
        if cn == target:
            best, why = cand, "exact name match"; break
    if not best:
        for cand in cands:
            cn = norm(cand.get("company_name") or "")
            if cn and (cn.startswith(target) or target.startswith(cn)):
                best, why = cand, "name prefix match"; break
    if not best and cands:
        best, why = cands[0], "TOP RESULT ONLY, unmatched name"

    row = {
        "title": job["title"], "company": c, "body_chars": job["body_chars"],
        "domain": (best or {}).get("domain"),
        "matched_name": (best or {}).get("company_name"),
        "hunter_emails": (best or {}).get("email_count"),
        "why": why or ("error: " + err if err else "no candidates"),
        "alternatives": [f"{x.get('company_name')} -> {x.get('domain')} ({x.get('email_count')})"
                         for x in cands if x is not best][:4],
        "departments": None,
    }
    if row["domain"] and (row["hunter_emails"] or 0) > 0:
        ec = get("email-count", domain=row["domain"]).get("data") or {}
        dept = {k: v for k, v in (ec.get("department") or {}).items() if v}
        row["departments"] = dict(sorted(dept.items(), key=lambda kv: -kv[1]))
        row["personal"] = ec.get("personal_emails")
        row["generic"] = ec.get("generic_emails")
    rows.append(row)
    time.sleep(0.15)

acct_after = get("account")["data"]["requests"]

json.dump({"rows": rows}, open(OUT, "w", encoding="utf-8"), indent=1)

W = 30
print(f"{'COMPANY':<30} {'DOMAIN':<32} {'#':>6}  MATCH")
print("-" * 100)
for r in rows:
    print(f"{r['company'][:29]:<30} {str(r['domain'])[:31]:<32} {str(r['hunter_emails']):>6}  {r['why']}")

print("\n--- HR / management / executive coverage where Hunter knows them ---")
for r in rows:
    if r.get("departments"):
        top = ", ".join(f"{k}:{v}" for k, v in list(r["departments"].items())[:6])
        print(f"{r['company'][:29]:<30} personal={r.get('personal')} generic={r.get('generic')} | {top}")

print("\n--- ACCOUNT DELTA ---")
for k in ("searches", "verifications", "credits"):
    b = acct_before.get(k, {}).get("used"); a = acct_after.get(k, {}).get("used")
    print(f"{k:15} {b} -> {a}  {'MOVED' if b != a else 'no change'}")
print(f"\nwrote {OUT}")
