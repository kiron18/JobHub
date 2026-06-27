#!/usr/bin/env node
/**
 * obsidian-sync.js — polls JobHub API for completed battle cards and writes
 * them as markdown files to your local Obsidian vault.
 *
 * Usage:
 *   node scripts/obsidian-sync.js
 *
 * Required env vars (set in a .env.local or pass inline):
 *   OBSIDIAN_SYNC_KEY   — shared secret, must match the server env var
 *   API_URL             — defaults to http://localhost:3002/api (local dev)
 *                         set to https://your-railway-url.up.railway.app/api for prod
 *
 * Optional:
 *   OBSIDIAN_VAULT      — absolute path to vault (default: C:/Users/Kiron/Obsidian)
 *   OBSIDIAN_FOLDER     — subfolder inside vault for call cards (default: Calls)
 *   POLL_INTERVAL_MS    — how often to check in ms (default: 60000)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local if present
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const API_URL       = process.env.API_URL        || 'http://localhost:3002/api';
const SYNC_KEY      = process.env.OBSIDIAN_SYNC_KEY;
const VAULT_PATH    = process.env.OBSIDIAN_VAULT  || 'C:/Users/Kiron/Obsidian';
const FOLDER        = process.env.OBSIDIAN_FOLDER || 'Calls';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);

if (!SYNC_KEY) {
  console.error('[obsidian-sync] ERROR: OBSIDIAN_SYNC_KEY env var is required.');
  process.exit(1);
}

const OUTPUT_DIR = path.join(VAULT_PATH, FOLDER);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`[obsidian-sync] Created folder: ${OUTPUT_DIR}`);
}

console.log(`[obsidian-sync] Started — polling ${API_URL} every ${POLL_INTERVAL / 1000}s`);
console.log(`[obsidian-sync] Writing cards to: ${OUTPUT_DIR}`);

async function sync() {
  let cards;
  try {
    const res = await fetch(`${API_URL}/bookings/ready-cards`, {
      headers: { 'x-obsidian-sync-key': SYNC_KEY },
    });
    if (!res.ok) {
      console.error(`[obsidian-sync] API error ${res.status}`);
      return;
    }
    cards = await res.json();
  } catch (err) {
    console.error('[obsidian-sync] Network error:', err.message);
    return;
  }

  if (!cards.length) return;

  console.log(`[obsidian-sync] ${cards.length} card(s) ready`);

  for (const card of cards) {
    const filePath = path.join(OUTPUT_DIR, card.filename);
    try {
      fs.writeFileSync(filePath, card.content, 'utf8');
      console.log(`[obsidian-sync] Written: ${card.filename}`);

      // Acknowledge so the server marks it synced
      await fetch(`${API_URL}/bookings/ready-cards/${card.id}/ack`, {
        method: 'PATCH',
        headers: { 'x-obsidian-sync-key': SYNC_KEY },
      });
    } catch (err) {
      console.error(`[obsidian-sync] Failed to write ${card.filename}:`, err.message);
    }
  }
}

// Run immediately, then on interval
sync();
setInterval(sync, POLL_INTERVAL);
