// Read-only: lists recent successful Stripe payments so we can confirm who paid.
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv(path.join(__dirname, '.env'));
loadEnv(path.join(__dirname, '.env.local'));

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

const TARGETS = ['pawan', 'hewage', 'ananya', 'awasthi', 'kangesh', 'vaibhav', 'singh', 'mayank', 'parekh', 'khushal', 'malik', 'khushag', 'rai'];

(async () => {
  const acct = await stripe.accounts.retrieve().catch(() => null);
  console.log('Account:', acct ? (acct.settings?.dashboard?.display_name || acct.id) : '(could not read)');
  console.log('Mode:', process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST');
  console.log('='.repeat(90));

  const rows = [];
  let starting_after;
  let scanned = 0;
  // pull up to ~300 most recent charges
  for (let i = 0; i < 3; i++) {
    const page = await stripe.charges.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
    for (const c of page.data) {
      scanned++;
      rows.push({
        date: new Date(c.created * 1000).toISOString().slice(0, 10),
        name: c.billing_details?.name || '',
        email: c.billing_details?.email || c.receipt_email || '',
        amount: (c.amount / 100).toFixed(2) + ' ' + c.currency.toUpperCase(),
        status: c.paid ? (c.refunded ? 'REFUNDED' : 'paid') : c.status,
        desc: c.description || '',
      });
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }

  console.log(`Scanned ${scanned} most-recent charges.\n`);

  const matches = rows.filter(r => {
    const hay = (r.name + ' ' + r.email).toLowerCase();
    return TARGETS.some(t => hay.includes(t));
  });

  console.log('--- MATCHES to your named clients ---');
  if (!matches.length) console.log('(none matched by name/email — see full recent list below)');
  for (const r of matches) console.log(`${r.date}  ${r.status.padEnd(8)}  ${r.amount.padEnd(12)}  ${r.name} <${r.email}>  ${r.desc}`);

  console.log('\n--- ALL recent successful payments ---');
  for (const r of rows.filter(r => r.status === 'paid')) {
    console.log(`${r.date}  ${r.amount.padEnd(12)}  ${(r.name || '(no name)').padEnd(24)}  ${r.email}`);
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
