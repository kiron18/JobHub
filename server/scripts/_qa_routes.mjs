// QA helper: lists every Express route as METHOD /full/path by reading the source.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');

function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [base + '.ts', path.join(base, 'index.ts'), base]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

function importsOf(file, text) {
  const map = {};
  for (const m of text.matchAll(/import\s+(\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const f = resolveImport(file, m[2]); if (f) map[m[1]] = f;
  }
  for (const m of text.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const f = resolveImport(file, m[2]); if (!f) continue;
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/);
      if (orig) map[(alias || orig).trim()] = f;
    }
  }
  return map;
}

const out = [];
const seen = new Set();
function walk(file, prefix) {
  const key = file + '|' + prefix;
  if (seen.has(key)) return; seen.add(key);
  const text = fs.readFileSync(file, 'utf8');
  const imps = importsOf(file, text);
  const routerVars = new Set([...text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:express\.)?Router\(/g)].map(m => m[1]));
  for (const v of routerVars) {
    const re = new RegExp(`\\b${v}\\.(get|post|put|patch|delete)\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
    for (const m of text.matchAll(re)) out.push({ method: m[1].toUpperCase(), path: (prefix + m[2]).replace(/\/+/g, '/').replace(/(.)\/$/, '$1'), file: path.relative(SRC, file) });
    const useRe = new RegExp(`\\b${v}\\.use\\(\\s*(?:['"\`]([^'"\`]*)['"\`]\\s*,\\s*)?([^)]*)\\)`, 'g');
    for (const m of text.matchAll(useRe)) {
      const ident = m[2].split(',').map(s => s.trim()).reverse().find(s => imps[s]);
      if (ident) walk(imps[ident], prefix + (m[1] || ''));
    }
  }
}

const index = path.join(SRC, 'index.ts');
const itext = fs.readFileSync(index, 'utf8');
const imps = importsOf(index, itext);
for (const m of itext.matchAll(/app\.use\(\s*['"`](\/api[^'"`]*)['"`]\s*,([^;]*?)\);/gs)) {
  const ident = m[2].split(',').map(s => s.trim()).reverse().find(s => imps[s]);
  if (ident) walk(imps[ident], m[1]);
}
for (const m of itext.matchAll(/app\.(get|post)\(\s*['"`](\/api[^'"`]*)['"`]/g)) out.push({ method: m[1].toUpperCase(), path: m[2], file: 'index.ts' });

const uniq = [...new Map(out.map(r => [r.method + ' ' + r.path, r])).values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
fs.writeFileSync(process.argv[2] || 'routes.json', JSON.stringify(uniq, null, 2));
console.log(uniq.length, 'routes');
