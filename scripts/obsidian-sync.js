#!/usr/bin/env node
/**
 * obsidian-sync.js — polls JobHub API for completed battle cards and writes
 * them into per-client folders inside your Obsidian vault.
 *
 * Output structure:
 *   <OBSIDIAN_VAULT>/Clients/<Name>/Battle Card — YYYY-MM-DD.md
 *   <OBSIDIAN_VAULT>/Clients/<Name>/Resume.md   (if resume was uploaded)
 *
 * Usage:
 *   node scripts/obsidian-sync.js
 *
 * Required env vars (set in .env.local or pass inline):
 *   OBSIDIAN_SYNC_KEY   — shared secret, must match the server env var
 *
 * Optional:
 *   API_URL             — defaults to http://localhost:3002/api
 *   OBSIDIAN_VAULT      — absolute path to vault (default: C:/Users/Kiron/Obsidian)
 *   CLIENTS_FOLDER      — subfolder inside vault (default: Clients)
 *   POLL_INTERVAL_MS    — how often to check in ms (default: 60000)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const API_URL       = process.env.API_URL        || 'http://localhost:3002/api';
const SYNC_KEY      = process.env.OBSIDIAN_SYNC_KEY;
const VAULT_PATH    = process.env.OBSIDIAN_VAULT  || 'C:/Users/Kiron/Obsidian';
const CLIENTS_DIR   = process.env.CLIENTS_FOLDER  || 'Clients';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);

if (!SYNC_KEY) {
  console.error('[obsidian-sync] ERROR: OBSIDIAN_SYNC_KEY env var is required.');
  process.exit(1);
}

const CLIENTS_PATH = path.join(VAULT_PATH, CLIENTS_DIR);
if (!fs.existsSync(CLIENTS_PATH)) {
  fs.mkdirSync(CLIENTS_PATH, { recursive: true });
  console.log(`[obsidian-sync] Created: ${CLIENTS_PATH}`);
}

console.log(`[obsidian-sync] Started — polling ${API_URL} every ${POLL_INTERVAL / 1000}s`);
console.log(`[obsidian-sync] Writing to: ${CLIENTS_PATH}`);

function safeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').trim() || 'Unknown';
}

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
    const clientFolder = path.join(CLIENTS_PATH, safeName(card.clientName));

    try {
      // Create client folder if needed
      if (!fs.existsSync(clientFolder)) {
        fs.mkdirSync(clientFolder, { recursive: true });
        console.log(`[obsidian-sync] Created folder: ${safeName(card.clientName)}/`);
      }

      // Write battle card
      const cardFile = path.join(clientFolder, `Battle Card — ${card.folderDate}.md`);
      fs.writeFileSync(cardFile, card.battleCard, 'utf8');
      console.log(`[obsidian-sync] Written: ${safeName(card.clientName)}/Battle Card — ${card.folderDate}.md`);

      // Write resume if available
      if (card.resumeText) {
        const resumeFile = path.join(clientFolder, 'Resume.md');
        const resumeContent = `# Resume — ${card.clientName}\n\n\`\`\`\n${card.resumeText}\n\`\`\`\n`;
        fs.writeFileSync(resumeFile, resumeContent, 'utf8');
        console.log(`[obsidian-sync] Written: ${safeName(card.clientName)}/Resume.md`);
      }

      // Acknowledge so server marks it synced
      await fetch(`${API_URL}/bookings/ready-cards/${card.id}/ack`, {
        method: 'PATCH',
        headers: { 'x-obsidian-sync-key': SYNC_KEY },
      });
    } catch (err) {
      console.error(`[obsidian-sync] Failed for ${card.clientName}:`, err.message);
    }
  }
}

sync();
setInterval(sync, POLL_INTERVAL);
