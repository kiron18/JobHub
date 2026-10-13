/**
 * Renders one chapter:  node video/render.mjs application [--vertical]
 * Copies the latest take into public/ (where Remotion reads media from) first.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
const vertical = process.argv.includes('--vertical');
const here = import.meta.dirname;
const dir = vertical ? `${name}-9x16` : name;
const take = path.join(here, 'out', dir, 'screen.mp4');
if (!name || !fs.existsSync(take)) { console.error('usage: node video/render.mjs <chapter> [--vertical]   (shoot it first)'); process.exit(1); }
fs.mkdirSync(path.join(here, 'public', dir), { recursive: true });
fs.copyFileSync(take, path.join(here, 'public', dir, 'screen.mp4'));
const id = name[0].toUpperCase() + name.slice(1) + (vertical ? 'Vertical' : '');
const out = path.join('out', dir, `${name}-${vertical ? '9x16' : '16x9'}.mp4`);
const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', id, out, '--crf', '18', '--log', 'error'], { cwd: here, stdio: 'inherit', shell: true });
if (r.status === 0) console.log('->', path.join('video', out));
process.exit(r.status ?? 1);
