/**
 * STAGING-ONLY throwaway — send yourself one sample follow-up reminder email
 * so you can eyeball the real rendering (hosted screenshot, links, emoji) in a
 * real inbox without waiting for the 09:00 UTC cron.
 *
 * Do NOT merge this to master — it exists only on the staging branch.
 *
 * Usage (run from server/):
 *   npx tsx src/scripts/testFollowUpNudge.ts [email]
 *   (defaults to kiron182@gmail.com)
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { sendFollowUpReminderEmail } from '../services/email';

async function main() {
  const to = process.argv[2] || 'kiron182@gmail.com';

  await sendFollowUpReminderEmail({
    to,
    firstName: 'Priya',
    jobs: [
      { title: 'Social Media Marketing Coordinator', company: 'Canva' },
      { title: 'Marketing Coordinator', company: 'Landen Property' },
      { title: 'Content Strategist', company: 'Atlassian' },
    ],
    totalCount: 5,
  });

  console.log(`[testFollowUpNudge] Sent sample follow-up reminder to ${to}`);
}

main().catch(err => {
  console.error('[testFollowUpNudge] Failed:', err);
  process.exit(1);
});
