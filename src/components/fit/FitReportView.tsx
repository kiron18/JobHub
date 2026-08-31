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
import { ArrowRight, Check, Clock, Info, Search, X } from 'lucide-react';
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
  /**
   * Context on being further along than the ad asks for, read off the ad on the
   * server. Null unless the gap is wide and the ad is genuinely open to them.
   */
  seniority?: string | null;
}

interface Props {
  report: FitReport;
  /** Where "build the resume for this job" goes. */
  onTailor: () => void;
  /** Start over with another ad. */
  onCheckAnother: () => void;
  /** Used to keep a job search local to where they actually want to work. */
  targetCity?: string | null;
  /**
   * Their own target role, as the fallback for the Seek search.
   *
   * On a mismatch the model usually names two or three titles they could win
   * today, and those make the better search. But it returns an empty list often
   * enough that the screen could end on "look somewhere else" with nowhere to
   * go, which is the one dead end this page must never have.
   */
  targetRole?: string | null;
  /** True once the job has been written to their tracker, which the check does. */
  saved?: boolean;
}

/**
 * Two doors, and the number is not one of them.
 *
 * There used to be a 56px percentage at the top of this screen. It had to go.
 * The evaluator separates a designed match from a designed mismatch cleanly,
 * which is what makes the apply/don't call trustworthy, but nothing we have
 * ever measured says a 72 is really better odds than a 68. Printing a figure
 * to that precision claims an accuracy we cannot defend, and the first time a
 * candidate compares two of them we have lied to someone.
 *
 * So the screen answers the only question they asked: is this worth my hour.
 * `band` still decides the sub-line, because whether the resume needs
 * rewriting first is an instruction, not a third confidence level.
 *
 * `fit` stays in the payload and the database. It is the eval's measuring
 * stick, and without it there is no way to notice the prompt has drifted.
 * It is simply never shown.
 */
const VERDICT: Record<FitReport['band'], { headline: string; sub: string; colour: string }> = {
  strong: {
    headline: 'Worth applying',
    sub: 'You are the person this ad describes.',
    colour: C.success,
  },
  stretch: {
    headline: 'Worth applying',
    sub: 'Once the resume is written for this ad.',
    colour: C.success,
  },
  mismatch: {
    headline: 'Not this one',
    sub: 'The gap here is not something a rewrite closes.',
    colour: C.textMuted,
  },
};

/**
 * What to do about this job, one line per band.
 *
 * These name all three deliverables (resume, cover letter, follow-up mail)
 * because that is what the work actually is. The earlier copy mentioned only
 * the resume, which undersold it and left the follow-up looking like a bonus
 * rather than the part that gets replies.
 *
 * `stretch` keeps the resume in the list on purpose. The band is defined as
 * winnable ONCE THE RESUME IS WRITTEN FOR THIS AD, so a stretch remedy that
 * offers only a cover letter contradicts the thing being scored.
 */
const NEXT_STEP: Record<FitReport['band'], string> = {
  strong:
    'You match this role. A personalised resume, cover letter and follow-up mail is what turns that match into an interview.',
  stretch:
    'You do not match this role entirely, but a resume and cover letter written for this ad, plus a follow-up mail, can still get you an interview.',
  mismatch:
    'You do not match this role. No amount of rewrites closes this gap, so find another job.',
};

/**
 * How long the next step takes, in minutes.
 *
 * A promise we keep, not a measurement. It is the number that makes "send out
 * hundreds of applications" arithmetic rather than a slogan, so it has to stay
 * true. One constant, in one place: if the generation gets slower, or if strong
 * and stretch ever diverge enough to need separate figures, change it here
 * rather than scattering minutes through the copy.
 */
const APPLICATION_ETA_MINUTES = 3;

/**
 * The follow-up promise, tacked onto the corner of the next-step card.
 *
 * Deliberately reads as a stamp rather than a sentence: it is a standing fact
 * about every application, not advice about this one, and giving it the same
 * type as the copy around it would make it look like a fourth thing to read.
 */
function FollowUpSticker() {
  return (
    <span
      aria-label="Automated follow up with every application"
      style={{
        position: 'absolute', top: -14, right: 14,
        width: 94, height: 94, borderRadius: '50%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 8, boxSizing: 'border-box',
        background: C.accentGold, color: '#fff',
        transform: 'rotate(-9deg)',
        boxShadow: '0 6px 16px -8px rgba(26,24,20,0.55)',
        fontSize: 10.5, fontWeight: 800, lineHeight: 1.25,
        letterSpacing: '0.01em', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}
    >
      Automated follow&#8209;up with every application
    </span>
  );
}

/**
 * Three reasons a side, hard stop.
 *
 * A list of eight is a score wearing a disguise: people count them and compare
 * the counts, which is the habit this screen exists to break. Three is what
 * someone actually reads before deciding.
 */
const MAX_REASONS = 3;

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

/** A flat statement of fact about the ad. Never a verdict, never an action. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '13px 15px',
      background: C.bgAlt,
      border: `1px solid ${C.borderWhisper}`,
      borderRadius: warm.radius.input,
    }}>
      <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: C.textMuted }} />
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
        {children}
      </p>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function FitReportView({ report, onTailor, onCheckAnother, targetCity, targetRole, saved }: Props) {
  const verdict = VERDICT[report.band];
  const applying = report.outcome === 'apply';

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

      {/* The answer, and only the answer. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '18px 20px',
        background: applying ? 'rgba(42,157,111,0.07)' : C.bgAlt,
        border: `1px solid ${applying ? 'rgba(42,157,111,0.28)' : C.borderDefined}`,
        borderRadius: warm.radius.card,
      }}>
        <span style={{
          flexShrink: 0, marginTop: 2,
          width: 26, height: 26, borderRadius: 99,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: verdict.colour, color: '#fff',
        }}>
          {applying ? <Check size={15} strokeWidth={3.5} /> : <X size={15} strokeWidth={3.5} />}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: 'block',
            fontSize: 'clamp(19px, 3.4vw, 23px)', fontWeight: 800,
            letterSpacing: '-0.02em', lineHeight: 1.2, color: C.textPrimary,
          }}>
            {verdict.headline}
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 15, lineHeight: 1.5, color: C.textSecondary }}>
            {verdict.sub}
          </span>
        </span>
      </div>

      {/*
        What the ad requires on work rights. It sits above the verdict because
        it is a fact about the job, not a judgement on them, and it is never
        allowed to move the number: the evaluator is told to ignore the topic.
        We state it and let them decide.
      */}
      {report.workRights && <Notice>{report.workRights}</Notice>}

      {/*
        Sits beside work rights and plays by the same rules: a fact about the
        ad, never a judgement on them, and forbidden from moving the verdict or
        the next step. It exists because the arithmetic and the advice can be
        both right and unhelpful at once. An employer really will screen out
        someone far past the ask, and a first Australian role below your level
        really is how a lot of people get their local history started. The
        report keeps its answer; this adds what the answer cannot see.
      */}
      {report.seniority && <Notice>{report.seniority}</Notice>}

      {/* The model's own words. The whole report in a paragraph. */}
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.textPrimary }}>
        {report.verdict}
      </p>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <Evidence
          icon={<Check size={13} strokeWidth={3} />}
          tone={C.success}
          heading="Why"
          items={report.youHave.slice(0, MAX_REASONS)}
        />
        <Evidence
          icon={<X size={13} strokeWidth={3} />}
          tone={C.accentGold}
          heading="What is against you"
          items={report.missing.slice(0, MAX_REASONS)}
        />
      </div>

      {/* The next step. One button. */}
      <div style={{
        position: 'relative',
        padding: 24,
        background: C.bgAlt,
        border: `1px solid ${C.borderWhisper}`,
        borderRadius: warm.radius.card,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/*
          The follow-up promise, said on the first report someone ever sees
          rather than only inside the tracker they reach a week later. It is the
          proof of the argument the rest of the funnel makes: the edge is volume
          and follow-up, and the follow-up is handled.

          Only on apply. On a mismatch there is nothing to follow up, and a
          badge selling the next thing sits badly next to an honest "no".
        */}
        {report.outcome === 'apply' && <FollowUpSticker />}

        {report.outcome === 'apply' ? (
          <>
            <div style={{ paddingRight: 96 }}>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
                Your next step
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.textSecondary }}>
                {NEXT_STEP[report.band]}
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
              {/*
                The price of the next action, next to the action rather than up
                by the verdict. Sitting here it answers the only objection left
                for someone who has just been told to apply: not "is it worth
                it" but "how long is this going to take me".

                It is also what makes the "send out hundreds" claim earlier in
                the funnel arithmetic instead of a slogan.
              */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13.5, fontWeight: 700, color: C.textSecondary,
                whiteSpace: 'nowrap',
              }}>
                <Clock size={14} strokeWidth={2.5} style={{ color: C.accentGold }} />
                ETA: {APPLICATION_ETA_MINUTES} min
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
                Spend the hour somewhere else
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.textSecondary }}>
                {NEXT_STEP.mismatch}{' '}
                {report.searchRoles.length > 0
                  ? 'These are the titles your experience already answers.'
                  : 'Look for roles closer to what you have actually done.'}
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

            {/*
              Two ways out, and neither leaves the page.

              Search opens Seek in a new tab, so the report they just read is
              still here when they come back with an ad worth checking. Check
              another clears this screen back to the empty paste box in place.
            */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <PrimaryButton onClick={onCheckAnother}>
                Check another job <ArrowRight size={17} />
              </PrimaryButton>

              {(report.searchRoles[0] ?? targetRole) && (
                <a
                  href={seekSearchUrl((report.searchRoles[0] ?? targetRole)!, targetCity)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px',
                    background: C.bgSurface,
                    border: `1px solid ${C.borderDefined}`,
                    borderRadius: warm.radius.button,
                    fontSize: 15, fontWeight: 700, color: C.textPrimary,
                    textDecoration: 'none', fontFamily: 'inherit',
                  }}
                >
                  <Search size={16} /> Search jobs on Seek
                </a>
              )}
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
