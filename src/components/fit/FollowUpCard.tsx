/**
 * The follow-up card.
 *
 * Shown once a job comes back a match, and again after the documents are done.
 * It is the only place the tracker sells itself, and it sells itself with three
 * facts rather than a feature list.
 *
 * The numbers are SEEK's own, from their careers advice on following up:
 * https://au.seek.com/career-advice/article/how-to-follow-up-a-job-application
 * They are quoted, not ours, and not rounded. If SEEK updates the article the
 * numbers here change with it, so they live in one array rather than in prose.
 *
 * Deliberately not a fear pitch. "70% of employers like it, 41% of candidates
 * never do it" is a gap the reader can walk into. A scare number would land
 * once and then be ignored.
 */
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;

const SERIF = "'Fraunces', Georgia, serif";

/** SEEK's figures, in the order they build the argument. */
const STATS: { figure: string; rest: string }[] = [
  { figure: '70%', rest: 'of Australian employers see a follow-up as a positive gesture.' },
  { figure: '41%', rest: 'of Australian candidates admit they never follow up.' },
  { figure: '78%', rest: 'of employers prefer to be contacted by email.' },
];

interface Props {
  /**
   * What we will actually do for them. Differs before and after they apply,
   * and saying the wrong one is worse than saying nothing.
   */
  variant: 'preview' | 'armed';
}

export function FollowUpCard({ variant }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
      style={{
        padding: '26px 26px 24px',
        background: C.bgSurface,
        border: `1px solid ${C.borderDefined}`,
        borderRadius: warm.radius.card,
      }}
    >
      {/* One fact per line. Stacked, not run together, because the three only
          work as an argument when you can see them as three. */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STATS.map(({ figure, rest }) => (
          <li key={figure} style={{
            display: 'flex', alignItems: 'baseline', gap: 12,
            fontSize: 15, lineHeight: 1.5, color: C.textSecondary,
          }}>
            <span style={{
              flexShrink: 0, minWidth: 52,
              fontSize: 20, fontWeight: 800, color: C.textPrimary,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            }}>
              {figure}
            </span>
            <span>{rest}</span>
          </li>
        ))}
      </ul>

      <div style={{
        marginTop: 22, paddingTop: 20,
        borderTop: `1px solid ${C.borderWhisper}`,
      }}>
        <p style={{
          margin: '0 0 10px',
          fontFamily: SERIF,
          fontSize: 19, fontWeight: 600,
          letterSpacing: '-0.01em', color: C.accentGold,
        }}>
          Which means
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, fontWeight: 700, color: C.textPrimary }}>
            Your highest impact move is free, and the tracker does it for you.
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.textSecondary }}>
            Employers want the follow-up.
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.textSecondary }}>
            Most of your competition is not sending one.
          </p>
        </div>

        <p style={{
          margin: '18px 0 0',
          display: 'flex', alignItems: 'flex-start', gap: 9,
          fontSize: 13.5, lineHeight: 1.55, color: C.textMuted,
        }}>
          <Bell size={14} style={{ flexShrink: 0, marginTop: 3, color: C.accentGold }} />
          <span>
            {variant === 'armed'
              ? 'Seven days after you apply we will email you a reminder with the follow-up already written. You copy it and send it.'
              : 'Apply through here and seven days later we email you a reminder with the follow-up already written, ready to copy and send.'}
          </span>
        </p>
      </div>
    </motion.div>
  );
}
