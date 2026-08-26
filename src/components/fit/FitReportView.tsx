/**
 * The fit report screen.
 *
 * What someone sees after pasting a job ad. They have usually sent a hundred
 * applications and heard nothing, so this screen has one job: tell them the
 * truth about this specific job and what to do next.
 *
 * Four things it has to do, in this order:
 *   1. Say plainly whether this is winnable.
 *   2. Show the evidence both ways, so the number is not a black box.
 *   3. Give them the next step, and only one.
 *   4. When the answer is no, say no and point somewhere better. A soft "maybe"
 *      on a job they cannot win costs them a week.
 *
 * Nothing on this screen decides the verdict. There is no threshold here that
 * flips the upsell on. `outcome` and `band` come from the report and this file
 * renders them. If the copy ever starts disagreeing with the number, the fix
 * is in the evaluator, not here.
 */
import { motion } from 'framer-motion';
import { ArrowRight, Check, Info, Search, X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { FollowUpCard } from './FollowUpCard';

const C = warm.colors;

export interface FitReport {
  jobTitle: string | null;
  company: string | null;
  fit: number;
  band: 'strong' | 'stretch' | 'mismatch';
  verdict: string;
  youHave: string[];
  missing: string[];
  outcome: 'apply' | 'search';
  searchRoles: string[];
  /**
   * A citizenship, residency, working-rights or clearance requirement the ad
   * states, read straight off the ad on the server. Null when it never says.
   */
  workRights?: string | null;
}

interface Props {
  report: FitReport;
  /** Where "build the resume for this job" goes. */
  onTailor: () => void;
  /** Start over with another ad. */
  onCheckAnother: () => void;
  /** Used to keep a job search local to where they actually want to work. */
  targetCity?: string | null;
  /** True once the job has been written to their tracker, which the check does. */
  saved?: boolean;
}

/**
 * The one line that names the band. The report already explains itself in
 * `verdict`; this is the label above it, not a second opinion.
 */
const BAND_LABEL: Record<FitReport['band'], string> = {
  strong: 'You can win this one',
  stretch: 'Winnable, but not with this resume',
  mismatch: 'Not this one',
};

const BAND_COLOUR: Record<FitReport['band'], string> = {
  strong: C.success,
  stretch: C.accentGold,
  mismatch: C.textMuted,
};

function seekSearchUrl(role: string, city?: string | null): string {
  const where = city ? `&where=${encodeURIComponent(city)}` : '';
  return `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(role)}${where}`;
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Evidence({ icon, tone, heading, items }: {
  icon: React.ReactNode;
  tone: string;
  heading: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <p style={{
        margin: '0 0 12px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tone,
      }}>
        {icon}{heading}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <li key={i} style={{
            fontSize: 14, lineHeight: 1.55, color: C.textSecondary,
            paddingLeft: 14, borderLeft: `2px solid ${tone}33`,
          }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrimaryButton({ onClick, href, children }: {
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '14px 24px',
    background: C.accentPetrol, color: C.textOnDeep,
    border: 'none', borderRadius: warm.radius.button,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none', fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)',
  };
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>
    : <button type="button" onClick={onClick} style={style}>{children}</button>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function FitReportView({ report, onTailor, onCheckAnother, targetCity, saved }: Props) {
  const bandColour = BAND_COLOUR[report.band];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      style={{ width: '100%', maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      {/* What we read the ad as. Shown so a bad paste is obvious immediately. */}
      <div>
        <h1 style={{
          margin: '0 0 4px', fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800,
          letterSpacing: '-0.02em', lineHeight: 1.2, color: C.textPrimary,
        }}>
          {report.jobTitle ?? 'This job'}
        </h1>
        {report.company && (
          <p style={{ margin: 0, fontSize: 15, color: C.textMuted }}>{report.company}</p>
        )}
      </div>

      {/* The number and the one-line read on it. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap',
        paddingBottom: 24, borderBottom: `1px solid ${C.borderWhisper}`,
      }}>
        <span style={{
          fontSize: 56, fontWeight: 800, lineHeight: 1,
          letterSpacing: '-0.04em', color: bandColour,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {report.fit}%
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>
          {BAND_LABEL[report.band]}
        </span>
      </div>

      {/*
        What the ad requires on work rights. It sits above the verdict because
        it is a fact about the job, not a judgement on them, and it is never
        allowed to move the number: the evaluator is told to ignore the topic.
        We state it and let them decide.
      */}
      {report.workRights && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '13px 15px',
          background: C.bgAlt,
          border: `1px solid ${C.borderWhisper}`,
          borderRadius: warm.radius.input,
        }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: C.textMuted }} />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
            {report.workRights}
          </p>
        </div>
      )}

      {/* The model's own words. The whole report in a paragraph. */}
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.textPrimary }}>
        {report.verdict}
      </p>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <Evidence
          icon={<Check size={13} strokeWidth={3} />}
          tone={C.success}
          heading="What counts here"
          items={report.youHave}
        />
        <Evidence
          icon={<X size={13} strokeWidth={3} />}
          tone={C.accentGold}
          heading="What they asked for and cannot see"
          items={report.missing}
        />
      </div>

      {/* The next step. One button. */}
      <div style={{
        padding: 24,
        background: C.bgAlt,
        border: `1px solid ${C.borderWhisper}`,
        borderRadius: warm.radius.card,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {report.outcome === 'apply' ? (
          <>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
                Your next step
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.textSecondary }}>
                {report.band === 'strong'
                  // Nothing is wrong with them. The gap is that a general resume
                  // makes a reader hunt for the match instead of being handed it.
                  ? 'You are already the person they are looking for. What decides this now is whether the first half page says so.'
                  : 'The experience is there. It is spread across a resume written for every job, so the parts this employer needs are not where they will look.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <PrimaryButton onClick={onTailor}>
                Write my resume for this job <ArrowRight size={17} />
              </PrimaryButton>
              <button
                type="button"
                onClick={onCheckAnother}
                style={{
                  background: 'none', border: 'none', padding: '14px 4px',
                  fontSize: 14, color: C.textMuted, cursor: 'pointer',
                  fontFamily: 'inherit', textDecoration: 'underline',
                }}
              >
                Check another job
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
                Spend the hour somewhere else
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.textSecondary }}>
                {report.searchRoles.length > 0
                  ? 'No resume rewrite closes this gap. These are the titles your experience already answers.'
                  : 'No resume rewrite closes this gap. Look for roles closer to what you have actually done.'}
              </p>
            </div>

            {report.searchRoles.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {report.searchRoles.map((role) => (
                  <a
                    key={role}
                    href={seekSearchUrl(role, targetCity)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 14px',
                      background: C.bgSurface,
                      border: `1px solid ${C.borderDefined}`,
                      borderRadius: warm.radius.pill,
                      fontSize: 13, fontWeight: 600, color: C.accentPetrol,
                      textDecoration: 'none',
                    }}
                  >
                    <Search size={13} />{role}
                  </a>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <PrimaryButton onClick={onCheckAnother}>
                Check another job <ArrowRight size={17} />
              </PrimaryButton>
            </div>
          </>
        )}
      </div>

      {/*
        Only on a match. On a mismatch the next move is another job, and a
        follow-up pitch for an application they are not going to send is noise.
      */}
      {report.outcome === 'apply' && <FollowUpCard variant="preview" />}

      {saved && (
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
          Saved to your tracker, whatever you decide.
        </p>
      )}
    </motion.div>
  );
}
