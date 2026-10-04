// QA helper: every API path the frontend calls, checked against the server's route list.
import fs from 'node:fs';
import path from 'node:path';

const routes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const FE = path.resolve('../src');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
  }
})(FE);

const calls = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  // api.get('/x'), api.post(`/x/${id}`), fetch(`${API_BASE}/x`), fetch(`${API_URL}/x`)
  for (const m of t.matchAll(/\bapi\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*(['"`])([^'"`]+)\2/g))
    calls.push({ method: m[1].toUpperCase(), raw: m[3], file: path.relative(FE, f) });
  for (const m of t.matchAll(/fetch\(\s*`\$\{(?:API_BASE|API_URL|API|BASE|apiBase|API_ROOT)\}([^`]+)`(?:\s*,\s*\{[^}]*?method:\s*['"](\w+)['"])?/g))
    calls.push({ method: (m[2] || 'GET').toUpperCase(), raw: m[1], file: path.relative(FE, f) });
}

const toRe = (p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\//g, '\\/') + '$');
const serverRes = routes.map(r => ({ ...r, re: toRe(r.path) }));
const norm = (raw) => ('/api' + raw.split('?')[0].replace(/\$\{[^}]+\}/g, 'X')).replace(/\/+$/, '');

const missing = [];
for (const c of calls) {
  const p = norm(c.raw);
  if (!p.startsWith('/api/')) continue;
  const hit = serverRes.some(r => r.re.test(p) && (r.method === c.method));
  if (!hit) missing.push(`${c.method} ${p}   <- ${c.file}`);
}
console.log(`${calls.length} frontend calls, ${[...new Set(missing)].length} with no matching server route:`);
for (const m of [...new Set(missing)].sort()) console.log('  ' + m);
