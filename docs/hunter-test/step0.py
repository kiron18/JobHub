"""Step 0: prove Hunter's free endpoints are actually free.

Reads /account, makes one email-count and one domain-finder call, reads
/account again, and prints the delta. Nothing here is a paid endpoint.
"""
import json, re, sys, urllib.parse, urllib.request

ENV = r"E:\AntiGravity\JobHub\server\.env"
KEY = None
for line in open(ENV, encoding="utf-8", errors="replace").read().splitlines():
    if line.startswith("HUNTER_API_KEY="):
        KEY = line.split("=", 1)[1].strip()
if not KEY:
    sys.exit("no HUNTER_API_KEY in .env")


def get(path, **params):
    params["api_key"] = KEY
    url = "https://api.hunter.io/v2/" + path + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def buckets(acct):
    d = acct.get("data", {})
    req = d.get("requests", {})
    return {k: req.get(k) for k in ("searches", "verifications", "credits")}


print("=== 1. /account BEFORE ===")
code, before = get("account")
print("http", code)
if code != 200:
    print(json.dumps(before, indent=1)); sys.exit(1)
d = before["data"]
print("plan:", d.get("plan_name"), "| level:", d.get("plan_level"), "| resets:", d.get("reset_date"))
print("buckets:", json.dumps(buckets(before), indent=1))

print("\n=== 2. /email-count (documented FREE) ===")
code, ec = get("email-count", domain="monash.edu", include_job_titles="1")
print("http", code)
data = ec.get("data", {})
print("total:", data.get("total"), "personal:", data.get("personal_emails"), "generic:", data.get("generic_emails"))
print("departments:", json.dumps(data.get("department"), indent=1))
print("seniority:", json.dumps(data.get("seniority"), indent=1))
jt = data.get("job_titles") or {}
print("job_titles returned:", len(jt), "->", list(jt.items())[:8])

print("\n=== 3. /domain-finder (documented FREE) ===")
code, df = get("domain-finder", company="Screen Australia")
print("http", code)
print(json.dumps(df.get("data"), indent=1)[:900])

print("\n=== 4. /account AFTER ===")
code, after = get("account")
print("http", code)
print("buckets:", json.dumps(buckets(after), indent=1))

print("\n=== DELTA ===")
b, a = buckets(before), buckets(after)
spent = False
for k in b:
    if b[k] is None and a[k] is None:
        print(f"{k:15} not reported")
        continue
    bu = (b[k] or {}).get("used")
    au = (a[k] or {}).get("used")
    moved = (bu != au)
    spent = spent or moved
    print(f"{k:15} used {bu} -> {au}   {'MOVED' if moved else 'no change'}")
print("\nVERDICT:", "SOMETHING WAS CHARGED" if spent else "all three calls were free, as documented")
