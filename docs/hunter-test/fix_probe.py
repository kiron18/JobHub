"""Can the wrong answers be fixed for free? Three levers, all free endpoints.

  A. append " Australia" to the company name
  B. perfect_match=true
  C. guess the obvious .gov.au / .com.au domain and ask email-count directly
"""
import json, time, urllib.parse, urllib.request

ENV = r"E:\AntiGravity\JobHub\server\.env"
KEY = next(l.split("=", 1)[1].strip()
           for l in open(ENV, encoding="utf-8", errors="replace").read().splitlines()
           if l.startswith("HUNTER_API_KEY="))


def get(path, **p):
    p["api_key"] = KEY
    url = "https://api.hunter.io/v2/" + path + "?" + urllib.parse.urlencode(p)
    try:
        with urllib.request.urlopen(url, timeout=25) as r:
            return json.load(r)
    except Exception as e:
        try:
            return json.load(e)
        except Exception:
            return {"errors": [{"details": str(e)}]}


def show(label, data):
    cands = data.get("data") or []
    if isinstance(cands, dict):
        cands = [cands]
    if not cands:
        err = (data.get("errors") or [{}])[0].get("details")
        print(f"    {label:<34} -> nothing{' (' + err + ')' if err else ''}")
        return
    out = "; ".join(f"{c.get('domain')}({c.get('email_count')})" for c in cands[:3])
    print(f"    {label:<34} -> {out}")


BAD = [
    ("Department of Defence", "defence.gov.au"),
    ("NSW Police Force", "police.nsw.gov.au"),
    ("Konnexus", "konnexus.com.au"),
    ("Di Placido Group", "diplacido.com.au"),
    ("HiTech Personnel", "hitechpersonnel.com.au"),
    ("NSN Electrical", "nsnelectrical.com.au"),
    ("Speed", None),
    ("WA Country Health Service", "wacountry.health.wa.gov.au"),
    ("Sekisui Pilon Pty Ltd", "sekisuifoam.com.au"),
    ("Dig Deep Excavations (NSW) Pty Ltd", "digdeepexcavations.com.au"),
    ("Erskine street Investments Pty Ltd", None),
    ("GIOXLE", None),
]

acct0 = get("account")["data"]["requests"]

for company, guess in BAD:
    print(f"\n{company}")
    show("A. + ' Australia'", get("domain-finder", company=company + " Australia", limit=3))
    show("B. perfect_match=true", get("domain-finder", company=company, perfect_match="true", limit=3))
    if guess:
        ec = get("email-count", domain=guess).get("data") or {}
        dept = {k: v for k, v in (ec.get("department") or {}).items() if v}
        top = ", ".join(f"{k}:{v}" for k, v in sorted(dept.items(), key=lambda kv: -kv[1])[:5])
        print(f"    C. email-count {guess:<28} -> total={ec.get('total')} personal={ec.get('personal_emails')} | {top}")
    time.sleep(0.15)

acct1 = get("account")["data"]["requests"]
print("\n--- ACCOUNT DELTA ---")
for k in ("searches", "verifications", "credits"):
    print(f"{k:15} {acct0[k]['used']} -> {acct1[k]['used']}  {'MOVED' if acct0[k]['used'] != acct1[k]['used'] else 'no change'}")
