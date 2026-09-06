"""Verify the SerpApi key, then test whether knowledge_graph and Maps actually
answer the domain question for a big and a small Australian employer.

Spends a handful of the 250 free searches. Account is read before and after so
the true cost is measured, not assumed.
"""
import json, subprocess, urllib.parse

ENV = r"E:\AntiGravity\JobHub\server\.env"
KEY = next(l.split("=", 1)[1].strip()
           for l in open(ENV, encoding="utf-8", errors="replace").read().splitlines()
           if l.startswith("SERPAPI_API_KEY="))


def api(path, **p):
    p["api_key"] = KEY
    url = f"https://serpapi.com/{path}?" + urllib.parse.urlencode(p)
    out = subprocess.run(["curl", "-s", "--max-time", "60", url],
                         capture_output=True, text=True, encoding="utf-8").stdout
    try:
        return json.loads(out)
    except Exception:
        return {"error": (out or "empty response")[:200]}


def acct():
    a = api("account.json")
    return a


print("=== ACCOUNT ===")
a0 = acct()
if "error" in a0:
    print("KEY FAILED:", a0["error"]); raise SystemExit(1)
for k in ("plan_name", "searches_per_month", "plan_searches_left",
          "this_month_usage", "this_hour_searches", "total_searches_left", "account_rate_limit_per_hour"):
    if k in a0:
        print(f"  {k:28} {a0[k]}")

CASES = [
    ("NSW Police Force", "Sydney NSW"),
    ("NSN Electrical", "Sydney NSW"),
    ("Sekisui Pilon Pty Ltd", "Taren Point, Sydney NSW"),
    ("Dig Deep Excavations", "NSW"),
]

for company, loc in CASES:
    print(f"\n{'='*70}\n{company}  [{loc}]")

    g = api("search.json", engine="google", q=f"{company} {loc}", gl="au", hl="en", num=6)
    kg = g.get("knowledge_graph") or {}
    print("  google:")
    print(f"    knowledge_graph.website : {kg.get('website')}")
    print(f"    knowledge_graph.title   : {kg.get('title')}  | type: {kg.get('type')}")
    if kg.get("address"):
        print(f"    knowledge_graph.address : {kg.get('address')}")
    for r in (g.get("organic_results") or [])[:4]:
        print(f"    organic  {r.get('link')}")
    if g.get("error"):
        print("    ERROR:", g["error"])

    m = api("search.json", engine="google_maps", q=f"{company} {loc}", type="search", hl="en", gl="au")
    print("  maps:")
    lr = m.get("local_results") or []
    if isinstance(lr, dict):
        lr = lr.get("places") or []
    for r in lr[:3]:
        print(f"    {r.get('title')} | {r.get('website')} | {r.get('address')}")
    pr = m.get("place_results") or {}
    if pr:
        print(f"    place_results: {pr.get('title')} | {pr.get('website')} | {pr.get('address')}")
    if m.get("error"):
        print("    ERROR:", m["error"])

print(f"\n{'='*70}\n=== ACCOUNT AFTER ===")
a1 = acct()
for k in ("plan_searches_left", "this_month_usage", "this_hour_searches", "total_searches_left"):
    if k in a1:
        print(f"  {k:28} {a0.get(k)} -> {a1[k]}")
