/**
 * One-off: pull the local Python CRM's leads into the online sales board.
 *
 *   npx tsx src/scripts/import-crm-leads.ts [--dir "E:/Obsidian Vault/Aussie Grad Careers/Leads"] [--apply]
 *
 * Dry run by default. Nothing is written without --apply, because this reads a
 * folder outside the repo whose shape can change without warning.
 *
 * The old board carried ten stages and sixty-odd people, most of whom were
 * cold LinkedIn invites that never answered. Everyone is imported, but anyone
 * with neither an email nor a resume is archived on arrival: there is no way to
 * contact them and nothing to read, so on a board that has to be scannable they
 * are noise. Archived, never deleted, since a name and a LinkedIn URL is still
 * reachable by hand.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { deriveStage } from '../services/salesLead';

const prisma = new PrismaClient();

const DEFAULT_DIR = 'E:/Obsidian Vault/Aussie Grad Careers/Leads';

/** The old stages, mapped onto the five that survived. */
const STAGE_MAP: Record<string, string> = {
  Invite: 'Lead',
  Connected: 'Lead',
  Messaged: 'Lead',
  FollowUp: 'Lead',
  Resume: 'Registered',
  Call: 'Registered',
  Pitched: 'Pitched',
  ReadyToBuy: 'Pitched',
  Client: 'Client',
  Dead: 'Dead',
};

interface ParsedLead {
  file: string;
  name: string;
  stage: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  company: string | null;
  notes: string | null;
  nextBest: string | null;
  hasResume: boolean;
}

/**
 * Whether a person has real documents on file, from the sibling Clients folder.
 *
 * ⚠️ This exists because the obvious rule was wrong in a way that would have
 * been expensive. Archiving on "no email and no resume in the markdown" hid two
 * paying clients and two live deals, because their documents live under
 * Clients/<name>/ and their lead file carries neither an email nor a resume
 * flag. A board that hides its own clients is worse than no board.
 */
function clientDocCount(clientsDir: string, name: string): number {
  if (!fs.existsSync(clientsDir)) return 0;
  const wanted = name.trim().toLowerCase();
  if (wanted.length < 3) return 0;

  let total = 0;
  for (const entry of fs.readdirSync(clientsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = entry.name.toLowerCase();
    // Folders are named loosely, sometimes with a LinkedIn status string
    // appended, so a prefix match on either side is the honest comparison.
    if (!folder.includes(wanted) && !wanted.includes(folder)) continue;
    const dir = path.join(clientsDir, entry.name);
    const walk = (p: string): number => {
      let n = 0;
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        if (e.isDirectory()) n += walk(path.join(p, e.name));
        else n++;
      }
      return n;
    };
    total += walk(dir);
  }
  return total;
}

function parseLead(file: string, text: string): ParsedLead | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm = m[1];

  const get = (key: string): string | null => {
    const hit = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(fm);
    if (!hit) return null;
    const v = hit[1].trim().replace(/^["']|["']$/g, '');
    return v || null;
  };

  const name = get('name') || path.basename(file, '.md');
  if (!name) return null;

  // "resume_collected: true" in the frontmatter, or an Intake section in the
  // body holding extracted resume text. Either means there is something to read.
  const hasResume =
    /^resume_collected:\s*true\s*$/m.test(fm) || /^###\s+resume\b/m.test(text);

  return {
    file,
    name,
    stage: STAGE_MAP[get('stage') ?? ''] ?? 'Lead',
    email: get('email')?.toLowerCase() ?? null,
    phone: get('phone'),
    linkedinUrl: get('profile_url'),
    headline: get('headline'),
    company: get('company'),
    notes: get('notes'),
    nextBest: get('next_best'),
    hasResume,
  };
}

/**
 * Noise is someone with no way to reach them and nothing to read.
 *
 * Anyone who got as far as being pitched is never noise, whatever the file is
 * missing: reaching the end of the pipeline is itself proof they were real.
 */
function isNoise(p: ParsedLead): boolean {
  if (p.stage === 'Client' || p.stage === 'Pitched') return false;
  return !p.email && !p.hasResume;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dirArg = args.indexOf('--dir');
  const dir = dirArg >= 0 ? args[dirArg + 1] : DEFAULT_DIR;

  if (!fs.existsSync(dir)) {
    console.error(`Leads folder not found: ${dir}`);
    process.exit(1);
  }

  // Clients/ sits beside Leads/ and holds the actual documents.
  const clientsDir = path.join(path.dirname(dir), 'Clients');

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const parsed = files
    .map((f) => parseLead(f, fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((p): p is ParsedLead => !!p)
    .map((p) => ({ ...p, hasResume: p.hasResume || clientDocCount(clientsDir, p.name) > 0 }));

  const keep = parsed.filter((p) => !isNoise(p));
  const archive = parsed.filter((p) => isNoise(p));

  console.log(`Parsed ${parsed.length} lead(s) from ${dir}`);
  console.log(`  active  : ${keep.length}  (has an email or a resume)`);
  console.log(`  archived: ${archive.length} (no email, no resume, still reachable on LinkedIn)`);
  console.log('');

  if (!apply) {
    for (const p of archive) console.log(`  [archive] ${p.name}`);
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of parsed) {
    const archived = isNoise(p);
    const data = {
      name: p.name,
      phone: p.phone,
      linkedinUrl: p.linkedinUrl,
      headline: p.headline,
      company: p.company,
      notes: p.notes,
      nextBest: p.nextBest,
      hasResume: p.hasResume,
      archived,
      source: 'linkedin-import',
      stage: p.stage,
    };

    if (!p.email) {
      // No email means no join key, so an upsert would create a duplicate on
      // every run. Match on the LinkedIn URL instead, and fall back to skipping
      // rather than risk two rows for one person.
      const existing = p.linkedinUrl
        ? await prisma.salesLead.findFirst({ where: { linkedinUrl: p.linkedinUrl } })
        : await prisma.salesLead.findFirst({ where: { name: p.name, email: null } });

      if (existing) {
        await prisma.salesLead.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.salesLead.create({ data });
        created++;
      }
      continue;
    }

    // A funnel signal always beats an imported stage: someone who registered or
    // paid since the export is further along than the markdown file knows.
    const existing = await prisma.salesLead.findUnique({ where: { email: p.email } });
    if (existing) {
      const derived = deriveStage(existing);
      await prisma.salesLead.update({
        where: { email: p.email },
        data: {
          ...data,
          stage: existing.stage === 'Dead' ? 'Dead' : (derived === 'Lead' ? p.stage : derived),
          // Never un-archive someone the funnel has already seen.
          archived: existing.registeredAt ? false : archived,
          hasResume: existing.hasResume || p.hasResume,
        },
      });
      updated++;
    } else {
      await prisma.salesLead.create({ data: { ...data, email: p.email } });
      created++;
    }
  }

  console.log(`Created ${created}, updated ${updated}, skipped ${skipped}.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
