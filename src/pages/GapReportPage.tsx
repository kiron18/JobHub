/* ────────────────────────────────────────────────────────────────────────────
   GapReportPage — /report/:token

   The diagnostic promised in the room and delivered within the hour. It is the
   highest-stakes page in the funnel: the only thing between a workshop attendee
   and a $750 decision, and the only asset that quotes their own writing back at
   them.

   Two rules govern everything below.

   Every number shown is COUNTED, never claimed. dutyBullets, totalBullets and
   the keyword counts all come from deterministic functions over the real
   document, so "13 more lines like this one" survives a sceptical reader
   checking it.

   The rewritten line is shown only when the server verified every figure in it
   against the source resume (see rewriteFiguresAreGrounded). When it did not,
   `translation` is null and this page renders without the exhibit rather than
   showing something persuasive we cannot stand behind.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Check, Lock, ArrowRight } from 'lucide-react';
import { colors, type as typeTokens } from '../components/landing/tokens';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

interface GapReport {
  firstName: string;
  inferredRole: string;
  firstImpression: string;
  reassurance: string;
  hiringManager: { name: string; archetype: string; view: string } | null;
  translation: { wrote: string; reads: string; instead: string } | null;
  withheldCount: number;
  metrics: {
    atsRisk: boolean;
    atsReasons: string[];
    dutyBullets: number;
    totalBullets: number;
    quantifiedBullets: number;
    keywordsPresent: number;
    keywordsExpected: number;
    keywordsMissing: string[];
  };
  items: { severity: 'critical' | 'warning' | 'good'; text: string }[];
  roadmap: { rank: number; title: string; why: string | null }[];
}

// ── The offer ────────────────────────────────────────────────────────────────
// Full price, never discounted: a lower number tells them the $750 was never
// real. The attendee advantage is added value instead, and the interview hour is
// the headline because it is the one thing here that cannot be mass-produced.
const PRICE = '$750';
const TERMS = 'Three payments of $250';

/**
 * Straight to checkout. They sat through the workshop and read the diagnosis, so
 * an intermediate sales page is one more screen to lose them on. Overridable by
 * env because a payment link changes far more often than this page does.
 */
const CHECKOUT_URL =
  import.meta.env.VITE_CHECKOUT_URL || 'https://buy.stripe.com/9B6bJ37d49YJ2o23psfMA04';
const BONUSES = [
  {
    headline: 'One hour of interview prep, one to one, free',
    detail:
      'Redeem it whenever you like, the day you book your first interview. It is the highest-value hour I sell, and it works for every interview you get after it.',
  },
  {
    headline: 'Your first five applications reviewed at week two',
    detail:
      'Send me the first five you send out and I will tell you exactly what is costing you replies, before you have burned fifty of them.',
  },
];

export default function GapReportPage() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<GapReport | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASE}/session-signup/report/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((d) => { setReport(d.report); setState('ready'); })
      .catch(() => setState('missing'));
  }, [token]);

  // The offer closes when the next room opens. A real deadline, and it moves
  // itself weekly because the schedule does.
  useEffect(() => {
    fetch(`${API_BASE}/session-signup/next`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.startsAt) return;
        const when = new Date(d.startsAt);
        if (Number.isNaN(when.getTime())) return;
        setDeadline(when.toLocaleString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: 'numeric', minute: '2-digit',
        }));
      })
      .catch(() => {});
  }, []);

  const page: React.CSSProperties = {
    height: '100vh', overflowY: 'auto', background: colors.bgCanvas,
    fontFamily: typeTokens.body, color: colors.textPrimary,
    padding: 'clamp(28px, 5vw, 56px) clamp(18px, 5vw, 32px) 96px',
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = {
    maxWidth: 704, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: 'clamp(40px, 7vw, 64px)',
  };
  const eyebrow: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: colors.textMuted, margin: 0,
  };
  const h2: React.CSSProperties = {
    fontFamily: typeTokens.display, fontWeight: 600,
    fontSize: 'clamp(1.3rem, 3.4vw, 1.6rem)', letterSpacing: '-0.015em', margin: 0,
  };
  const sec: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
  const card: React.CSSProperties = {
    background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
    borderRadius: 14, boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 10px 32px rgba(26,24,20,0.055)',
  };

  if (state === 'loading') {
    return (
      <div style={{ ...page, display: 'grid', placeItems: 'center' }}>
        <Loader2 size={26} className="animate-spin" color={colors.accentPetrol} />
      </div>
    );
  }

  if (state === 'missing' || !report) {
    return (
      <div style={{ ...page, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ ...h2, fontSize: '1.5rem', marginBottom: 12 }}>This report link is not valid.</h1>
          <p style={{ color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
            Check you opened the most recent link I emailed you. If it still will not
            load, reply to that email and I will send a fresh one.
          </p>
        </div>
      </div>
    );
  }

  const m = report.metrics;
  const gauges = [
    m.atsRisk
      ? { label: 'ATS parse', value: 'Fails', note: m.atsReasons[0] ?? 'The file does not read the way an ATS scans it.', tone: 'critical' as const }
      : { label: 'ATS parse', value: 'Clean', note: 'The file reads top to bottom the way an ATS scans it.', tone: 'good' as const },
    {
      label: 'Duty-led lines',
      value: `${m.dutyBullets} / ${m.totalBullets}`,
      note: 'Open with a task you were given, not a result you produced.',
      tone: m.dutyBullets > 0 ? ('critical' as const) : ('good' as const),
    },
    {
      label: 'Role keywords',
      value: `${m.keywordsPresent} / ${m.keywordsExpected}`,
      note: m.keywordsMissing.length ? `Missing: ${m.keywordsMissing.slice(0, 6).join(', ')}.` : 'You carry the terms this role is filtered on.',
      tone: m.keywordsMissing.length > 2 ? ('warn' as const) : ('good' as const),
    },
    {
      label: 'Quantified results',
      value: String(m.quantifiedBullets),
      note: m.quantifiedBullets > 0
        ? 'You do have hard numbers. The report says where they should sit.'
        : 'Not one line carries a number a manager can weigh.',
      tone: m.quantifiedBullets > 0 ? ('good' as const) : ('critical' as const),
    },
  ];

  const toneColor = (t: 'critical' | 'warn' | 'good') =>
    t === 'critical' ? '#A93B27' : t === 'warn' ? '#8F6A26' : '#25795A';
  const toneTint = (t: 'critical' | 'warn' | 'good') =>
    t === 'critical' ? 'rgba(169,59,39,0.09)' : t === 'warn' ? 'rgba(143,106,38,0.10)' : 'rgba(37,121,90,0.10)';

  const quoteLine: React.CSSProperties = {
    fontFamily: MONO, fontSize: '0.875rem', lineHeight: 1.65,
    background: colors.bgCanvas, border: `1px solid ${colors.borderWhisper}`,
    borderLeft: `3px solid ${colors.textMuted}`, borderRadius: '0 8px 8px 0',
    padding: '13px 15px', margin: 0, overflowX: 'auto', color: colors.textPrimary,
  };
  const beatLabel = (color: string): React.CSSProperties => ({
    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color, margin: 0,
  });

  return (
    <div style={page}>
      <div style={shell}>

        {/* Masthead */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 16, flexWrap: 'wrap',
          paddingBottom: 18, borderBottom: `1px solid ${colors.borderDefined}`,
        }}>
          <div>
            <p style={eyebrow}>Aussie Grad Careers</p>
            <strong style={{ fontFamily: typeTokens.display, fontSize: '1.0625rem', fontWeight: 600 }}>
              {report.firstName ? `${report.firstName}'s resume diagnostic` : 'Your resume diagnostic'}
            </strong>
          </div>
          <span style={{ fontSize: '0.8125rem', color: colors.textMuted }}>
            Built from the resume you sent me
          </span>
        </header>

        {/* The verdict */}
        <section style={{
          background: colors.bgDeep, color: colors.textOnDeep, borderRadius: 16,
          padding: 'clamp(26px, 5vw, 40px)', display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 2px 4px rgba(26,24,20,0.07), 0 18px 50px rgba(26,24,20,0.10)',
        }}>
          <p style={{ ...eyebrow, color: 'rgba(250,247,242,0.55)' }}>What your resume actually does</p>
          <h1 style={{
            fontFamily: typeTokens.display, fontWeight: 600,
            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)', lineHeight: 1.1,
            letterSpacing: '-0.02em', margin: 0, color: colors.textOnDeep,
          }}>
            {report.firstImpression}
          </h1>
          {report.inferredRole && (
            <p style={{
              fontSize: '0.875rem', color: 'rgba(250,247,242,0.62)', margin: 0,
              paddingTop: 16, borderTop: '1px solid rgba(250,247,242,0.16)',
            }}>
              Read against <b style={{ color: colors.textOnDeep }}>{report.inferredRole}</b>, the role your
              experience points at.
            </p>
          )}
        </section>

        {/* The relief */}
        {report.reassurance && (
          <p style={{
            fontFamily: typeTokens.display, fontSize: 'clamp(1.0625rem, 2.6vw, 1.25rem)',
            lineHeight: 1.55, margin: 0, maxWidth: '35rem',
            paddingLeft: 20, borderLeft: `2px solid ${colors.accentGold}`,
          }}>
            {report.reassurance}
          </p>
        )}

        {/* The measurements */}
        <section style={sec}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={eyebrow}>The measurements</p>
            <h2 style={h2}>Where it breaks, in numbers</h2>
            <p style={{ color: colors.textSecondary, margin: 0, maxWidth: '35rem' }}>
              Every figure below is counted from your document. Nothing here is estimated.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {gauges.map((g) => (
              <div key={g.label} style={{
                ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 7,
                borderTop: `3px solid ${toneColor(g.tone)}`,
              }}>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.11em',
                  textTransform: 'uppercase', color: colors.textMuted,
                }}>{g.label}</span>
                <span style={{
                  fontFamily: typeTokens.display, fontSize: '1.5rem', lineHeight: 1.1,
                  fontWeight: 600, color: toneColor(g.tone), fontVariantNumeric: 'tabular-nums',
                }}>{g.value}</span>
                <span style={{ fontSize: '0.8125rem', color: colors.textSecondary, lineHeight: 1.45 }}>
                  {g.note}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 1, background: colors.borderWhisper,
            border: `1px solid ${colors.borderWhisper}`, borderRadius: 12, overflow: 'hidden',
          }}>
            {report.items.map((it, i) => {
              const tone = it.severity === 'critical' ? 'critical' : it.severity === 'warning' ? 'warn' : 'good';
              return (
                <div key={i} style={{
                  background: colors.bgSurface, padding: '14px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 13,
                }}>
                  <span style={{
                    flex: '0 0 auto', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, marginTop: 2,
                    background: toneTint(tone), color: toneColor(tone),
                  }}>
                    {it.severity === 'good' ? 'Working' : it.severity}
                  </span>
                  <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, margin: 0 }}>{it.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* The other side of the desk */}
        {report.hiringManager && (
          <section style={sec}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={eyebrow}>The other side of the desk</p>
              <h2 style={h2}>
                What {report.hiringManager.name} thinks in the first six seconds
              </h2>
            </div>
            <div style={{
              background: 'rgba(45,90,110,0.07)', border: `1px solid ${colors.borderWhisper}`,
              borderRadius: 14, padding: 'clamp(22px, 4vw, 30px)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <blockquote style={{
                margin: 0, fontFamily: typeTokens.display,
                fontSize: 'clamp(1.0625rem, 2.5vw, 1.1875rem)', lineHeight: 1.55,
              }}>
                “{report.hiringManager.view}”
              </blockquote>
              <p style={{ fontSize: '0.8125rem', color: '#22485A', fontWeight: 600, margin: 0 }}>
                {report.hiringManager.name}, {report.hiringManager.archetype}
              </p>
            </div>
          </section>
        )}

        {/* The exhibit. Absent entirely when the server could not verify it. */}
        {report.translation && (
          <section style={sec}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={eyebrow}>The translation</p>
              <h2 style={h2}>One line from your resume, in three readings</h2>
              <p style={{ color: colors.textSecondary, margin: 0, maxWidth: '35rem' }}>
                This is your sentence, not an example.
              </p>
            </div>

            <div style={{
              ...card, borderColor: colors.borderDefined, borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 2px 4px rgba(26,24,20,0.07), 0 18px 50px rgba(26,24,20,0.10)',
            }}>
              <div style={{ padding: 'clamp(20px, 4vw, 28px)', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <p style={beatLabel(colors.textMuted)}>What you wrote</p>
                <p style={quoteLine}>{report.translation.wrote}</p>
              </div>

              <div style={{
                padding: 'clamp(20px, 4vw, 28px)', display: 'flex', flexDirection: 'column', gap: 11,
                borderTop: `1px solid ${colors.borderWhisper}`,
              }}>
                <p style={beatLabel('#A93B27')}>
                  What {report.hiringManager?.name ?? 'a hiring manager'} reads
                </p>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: colors.textSecondary, margin: 0, maxWidth: '35rem' }}>
                  {report.translation.reads}
                </p>
              </div>

              <div style={{
                padding: 'clamp(20px, 4vw, 28px)', display: 'flex', flexDirection: 'column', gap: 11,
                borderTop: `1px solid ${colors.borderWhisper}`, background: colors.bgAlt,
              }}>
                <p style={beatLabel('#25795A')}>What lands here</p>
                <p style={{ ...quoteLine, borderLeftColor: '#25795A', background: colors.bgSurface }}>
                  {report.translation.instead}
                </p>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: colors.textSecondary, margin: 0, maxWidth: '35rem' }}>
                  Same job. Same year. Same you. The only difference is that this version
                  answers the question they are actually asking.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* The withheld count */}
        {report.withheldCount > 0 && (
          <section style={{
            ...card, display: 'flex', alignItems: 'center', gap: 'clamp(16px, 4vw, 28px)',
            flexWrap: 'wrap', padding: 'clamp(22px, 4vw, 30px)',
          }}>
            <span style={{
              fontFamily: typeTokens.display, fontSize: 'clamp(3rem, 11vw, 4.5rem)', lineHeight: 0.9,
              fontWeight: 600, color: colors.accentGold, fontVariantNumeric: 'tabular-nums',
            }}>
              {report.withheldCount}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: '1 1 260px' }}>
              <strong style={{ fontFamily: typeTokens.display, fontSize: '1.125rem', fontWeight: 600 }}>
                There {report.withheldCount === 1 ? 'is 1 more line' : `are ${report.withheldCount} more lines`} exactly like that one.
              </strong>
              <p style={{ color: colors.textSecondary, fontSize: '0.9375rem', margin: 0, lineHeight: 1.55 }}>
                {report.metrics.dutyBullets} of your {report.metrics.totalBullets} bullet points open the
                same way. This report fixed one of them so you can see what the fix looks
                like. The rest are still in the document you are sending out this week.
              </p>
            </span>
          </section>
        )}

        {/* The roadmap */}
        <section style={sec}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={eyebrow}>The order to fix it in</p>
            <h2 style={h2}>Your {report.roadmap.length} moves, ranked by leverage</h2>
            <p style={{ color: colors.textSecondary, margin: 0, maxWidth: '35rem' }}>
              Ranked, because doing these out of order wastes the first two weeks.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.roadmap.map((s) => {
              const locked = !s.why;
              return (
                <div key={s.rank} style={{
                  display: 'flex', gap: 15, padding: '16px 18px', borderRadius: 12,
                  background: locked ? colors.bgAlt : colors.bgSurface,
                  border: `1px ${locked ? 'dashed' : 'solid'} ${colors.borderWhisper}`,
                }}>
                  <span style={{
                    flex: '0 0 auto', width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    background: locked ? colors.borderDefined : colors.accentPetrol,
                    color: locked ? colors.textMuted : colors.textOnDeep,
                  }}>{s.rank}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 650, margin: 0, lineHeight: 1.4 }}>{s.title}</h3>
                    {s.why
                      ? <p style={{ fontSize: '0.875rem', color: colors.textSecondary, margin: 0, lineHeight: 1.55 }}>{s.why}</p>
                      : <>
                          <span style={{ height: 11, borderRadius: 3, background: colors.borderDefined, opacity: 0.5, maxWidth: '22rem' }} />
                          <span style={{ height: 11, borderRadius: 3, background: colors.borderDefined, opacity: 0.5, maxWidth: '14rem' }} />
                        </>}
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{
            display: 'flex', alignItems: 'center', gap: 9,
            fontSize: '0.8125rem', color: colors.textSecondary, margin: 0,
          }}>
            <Lock size={14} color={colors.accentGold} style={{ flex: '0 0 auto' }} />
            The rest come with the rebuild. You already have the three that matter most.
          </p>
        </section>

        {/* The offer */}
        <section style={{
          border: `1.5px solid ${colors.accentGold}`, borderRadius: 18, overflow: 'hidden',
          background: colors.bgSurface,
          boxShadow: '0 2px 4px rgba(26,24,20,0.07), 0 18px 50px rgba(26,24,20,0.10)',
        }}>
          <div style={{
            background: 'rgba(197,160,89,0.13)', padding: 'clamp(22px, 4vw, 30px)',
            display: 'flex', flexDirection: 'column', gap: 9,
            borderBottom: `1px solid ${colors.accentGold}`,
          }}>
            <p style={{ ...eyebrow, color: '#A8823F' }}>Because you were in the room</p>
            <h2 style={{ ...h2, fontSize: 'clamp(1.4rem, 4vw, 1.875rem)' }}>
              I will do the rest of them with you.
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '0.9375rem', margin: 0, maxWidth: '35rem' }}>
              Not a template, not a course you watch alone. The rebuild, done together,
              then the system that gets it in front of people.
            </p>
          </div>

          <div style={{ padding: 'clamp(22px, 4vw, 30px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: typeTokens.display, fontSize: 'clamp(2rem, 7vw, 2.75rem)',
                lineHeight: 1, fontWeight: 600,
              }}>{PRICE}</span>
              <span style={{ fontSize: '0.875rem', color: colors.textSecondary }}>{TERMS}</span>
            </div>

            <ul style={{ display: 'flex', flexDirection: 'column', gap: 9, listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'Your resume rebuilt line by line, including every duty-led bullet',
                'The full roadmap, with the steps still locked above',
                'The application system, built for the 25-a-week cadence',
                'Weekly accountability until you are getting interviews',
              ].map((line) => (
                <li key={line} style={{ display: 'flex', gap: 11, fontSize: '0.9375rem', lineHeight: 1.5, alignItems: 'flex-start' }}>
                  <span style={{
                    flex: '0 0 auto', width: 17, height: 17, borderRadius: '50%',
                    background: 'rgba(37,121,90,0.12)', color: '#25795A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 3,
                  }}><Check size={11} strokeWidth={3} /></span>
                  {line}
                </li>
              ))}
            </ul>

            {/* The attendee advantage. Added value rather than a lower number: a
                discount would tell them the price was never real. */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 14,
              background: colors.bgAlt, borderRadius: 12, padding: '18px 20px',
            }}>
              <p style={{ ...eyebrow, color: '#A8823F' }}>Yours only if you were in the room tonight</p>
              {BONUSES.map((b) => (
                <div key={b.headline} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: '0.9375rem', fontWeight: 650 }}>{b.headline}</strong>
                  <p style={{ fontSize: '0.875rem', color: colors.textSecondary, margin: 0, lineHeight: 1.55 }}>
                    {b.detail}
                  </p>
                </div>
              ))}
            </div>

            {deadline && (
              <p style={{
                background: 'rgba(169,59,39,0.08)', borderRadius: 10, padding: '13px 15px',
                fontSize: '0.875rem', lineHeight: 1.5, margin: 0,
              }}>
                <b style={{ color: '#A93B27' }}>The two bonuses close {deadline}.</b>{' '}
                That is when the next room opens. It is not a countdown gimmick, it is
                just the next workshop.
              </p>
            )}

            <a
              href={CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: colors.accentPetrol, color: colors.textOnDeep,
                padding: '17px 28px', borderRadius: 12, textDecoration: 'none',
                fontWeight: 650, fontSize: '1.0625rem',
                boxShadow: '0 2px 6px rgba(45,90,110,0.22), 0 10px 26px rgba(45,90,110,0.20)',
              }}
            >
              Start the rebuild
              <ArrowRight size={19} />
            </a>

            <p style={{ fontSize: '0.875rem', color: colors.textSecondary, textAlign: 'center', margin: 0, lineHeight: 1.55 }}>
              Not ready? Reply to the email this came in with and tell me the one thing
              making you hesitate. I will answer it properly, and I will not pitch you
              again in that reply.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
