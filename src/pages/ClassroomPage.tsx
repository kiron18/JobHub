/* ────────────────────────────────────────────────────────────────────────────
   ClassroomPage: /classroom and /classroom/:slug

   The free course, public, no account. Content is in src/config/classroom.

   What makes people finish a course is rarely the content. It is seeing where
   they are, knowing what to do next, and being able to come back to the exact
   spot. So the page is built around three things:

   1. The module list with ticks, and /classroom on its own reopening the first
      module not yet done. Progress lives in localStorage: there is no account
      here to hang it on, and losing it costs someone a few ticks, nothing more.
   2. Chapters under every video, so the 16 and 20 minute modules can be taken
      in pieces and rewatched by topic instead of scrubbed.
   3. One "do this next" per module. The loud thing on the page, because an
      hour of video with no action attached is how people learn and don't move.

   Downloads link to /free/:slug rather than the files. The email gate there is
   deliberate; this page must not become the way round it.

   Palette matches FreeResourcePage: white and blue, one gold accent.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { Check, Play, Download, ArrowRight, Clock, Users } from 'lucide-react';
import { CLASSROOM, findModule, formatTime, type ClassroomModule } from '../config/classroom';
import { FREE_RESOURCES } from '../config/freeResources';
import { useIsMobile } from '../hooks/useIsMobile';
import { trackClassroomModuleOpened, trackClassroomModuleDone } from '../lib/analytics';

const C = {
  bg: '#FFFFFF',
  alt: '#F4F8FB',
  ink: '#0F1E2B',
  ink2: '#4A5A68',
  ink3: '#8496A4',
  line: '#E2EAF1',
  blue: '#1857A0',
  blueTint: '#EAF2F9',
  gold: '#B8863B',
  goldTint: '#FBF3E3',
  good: '#1E8A5F',
  deep: '#0F2438',
};

const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const BODY = "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif";

const DONE_KEY = 'agc.classroom.done';
const CORE = CLASSROOM.filter((m) => m.n >= 0);
const BONUS = CLASSROOM.filter((m) => m.n < 0);

function readDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDone(done: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    /* private window or blocked storage: the ticks just won't survive a reload */
  }
}

function moduleLabel(m: ClassroomModule): string {
  if (m.n < 0) return 'Bonus';
  if (m.n === 0) return 'Start here';
  return `Module ${m.n}`;
}

export default function ClassroomPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [done, setDone] = useState<Set<string>>(readDone);
  // Bumped on every chapter click so the iframe remounts at the new start time
  // even when the same chapter is clicked twice.
  const [seek, setSeek] = useState<{ at: number; n: number } | null>(null);

  const mod = useMemo(() => findModule(slug), [slug]);

  useEffect(() => {
    if (mod) trackClassroomModuleOpened(mod.slug);
    setSeek(null);
  }, [mod]);

  // /classroom on its own picks up where you left off.
  if (!slug) {
    const next = CORE.find((m) => !done.has(m.slug)) ?? CORE[0];
    return <Navigate to={`/classroom/${next.slug}`} replace />;
  }
  if (!mod) return <Navigate to="/classroom" replace />;

  const order = [...CORE, ...BONUS];
  const nextMod = order[order.indexOf(mod) + 1] ?? null;
  const isDone = done.has(mod.slug);
  const coreDone = CORE.filter((m) => done.has(m.slug)).length;

  const toggleDone = () => {
    const nextSet = new Set(done);
    if (isDone) {
      nextSet.delete(mod.slug);
    } else {
      nextSet.add(mod.slug);
      trackClassroomModuleDone(mod.slug);
    }
    setDone(nextSet);
    writeDone(nextSet);
    if (!isDone && nextMod) navigate(`/classroom/${nextMod.slug}`);
  };

  const resources = mod.resources
    .map((s) => FREE_RESOURCES.find((r) => r.slug === s))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const src = mod.youtubeId
    ? `https://www.youtube-nocookie.com/embed/${mod.youtubeId}?rel=0&modestbranding=1` +
      (seek ? `&start=${seek.at}&autoplay=1` : '')
    : '';

  const list = (
    <nav aria-label="Modules" style={{
      background: C.alt, border: `1px solid ${C.line}`, borderRadius: 14, padding: 8,
    }}>
      <div style={{
        padding: '10px 12px 12px', fontSize: 13, color: C.ink2,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontWeight: 600, color: C.ink }}>{coreDone} of {CORE.length} done</span>
        <span style={{ flex: 1, height: 6, background: C.line, borderRadius: 99, overflow: 'hidden' }}>
          <span style={{
            display: 'block', height: '100%', width: `${(coreDone / CORE.length) * 100}%`,
            background: C.good, transition: 'width 300ms ease',
          }} />
        </span>
      </div>
      {[...CORE, ...BONUS].map((m) => {
        const current = m.slug === mod.slug;
        const ticked = done.has(m.slug);
        return (
          <Link
            key={m.slug}
            to={`/classroom/${m.slug}`}
            aria-current={current ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderRadius: 10, textDecoration: 'none',
              background: current ? C.bg : 'transparent',
              boxShadow: current ? '0 1px 3px rgba(15,36,56,0.08)' : 'none',
              marginTop: m.n < 0 ? 10 : 0,
            }}
          >
            <span style={{
              width: 26, height: 26, flexShrink: 0, borderRadius: 99,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
              background: ticked ? C.good : current ? C.blue : C.bg,
              color: ticked || current ? '#fff' : C.ink3,
              border: ticked || current ? 'none' : `1px solid ${C.line}`,
            }}>
              {ticked ? <Check size={14} strokeWidth={2.6} /> : m.n < 0 ? '+' : m.n}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', fontSize: 14, lineHeight: 1.35,
                color: current ? C.ink : C.ink2, fontWeight: current ? 600 : 400,
              }}>
                {m.title}
              </span>
            </span>
            <span style={{ fontSize: 12, color: C.ink3, flexShrink: 0 }}>{m.minutes}m</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div style={{
      height: '100dvh', overflowY: 'auto', background: C.bg,
      fontFamily: BODY, color: C.ink,
    }}>
      <header style={{
        borderBottom: `1px solid ${C.line}`, padding: isMobile ? '14px 16px' : '16px 32px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: C.ink, fontWeight: 600, fontSize: 15 }}>
          Aussie Grad Careers
        </Link>
        <span style={{ color: C.ink3 }}>/</span>
        <Link to="/classroom" style={{ textDecoration: 'none', color: C.ink2, fontSize: 15 }}>
          Classroom
        </Link>
      </header>

      <div style={{
        maxWidth: 1180, margin: '0 auto',
        padding: isMobile ? '20px 16px 48px' : '32px 32px 64px',
        display: 'grid', gap: isMobile ? 28 : 36,
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 340px',
        alignItems: 'start',
      }}>
        <main style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: C.ink3, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <span style={{ color: C.blue, fontWeight: 600 }}>{moduleLabel(mod)}</span>
            <Clock size={13} /> {mod.minutes} min
          </div>
          <h1 style={{
            fontFamily: DISPLAY, fontWeight: 500, margin: '0 0 8px',
            fontSize: isMobile ? 26 : 34, lineHeight: 1.15, letterSpacing: '-0.01em',
          }}>
            {mod.title}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: 1.55, color: C.ink2 }}>
            {mod.hook}
          </p>

          <div style={{
            position: 'relative', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden',
            background: C.deep,
          }}>
            {src ? (
              <iframe
                key={seek ? `${seek.at}-${seek.n}` : 'start'}
                src={src}
                title={mod.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10, color: '#C9D6E2',
                padding: 24, textAlign: 'center',
              }}>
                <Play size={32} />
                <span style={{ fontSize: 15 }}>This video is going up shortly.</span>
              </div>
            )}
          </div>

          {mod.note && (
            <p style={{
              margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.5, color: C.ink2,
              padding: '10px 14px', background: C.alt, borderRadius: 10,
            }}>
              <strong style={{ color: C.ink }}>Note: </strong>{mod.note}
            </p>
          )}

          {/* The one loud thing. */}
          <section style={{
            marginTop: 24, padding: isMobile ? 18 : 22, borderRadius: 14,
            background: C.goldTint, border: `1px solid #EFDDB8`,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: C.gold, marginBottom: 6,
            }}>
              Do this before the next module
            </div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: C.ink }}>{mod.doThis}</p>
            <button
              onClick={toggleDone}
              style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 18px', borderRadius: 10, cursor: 'pointer',
                fontFamily: BODY, fontSize: 15, fontWeight: 600,
                background: isDone ? C.bg : C.blue,
                color: isDone ? C.good : '#fff',
                border: isDone ? `1px solid ${C.line}` : 'none',
              }}
            >
              {isDone ? (
                <><Check size={16} /> Done</>
              ) : nextMod ? (
                <>Mark done, next module <ArrowRight size={16} /></>
              ) : (
                <>Mark done <Check size={16} /></>
              )}
            </button>
          </section>

          {mod.chapters.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Chapters</h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
                {mod.chapters.map((c) => (
                  <li key={c.at}>
                    <button
                      onClick={() => setSeek((s) => ({ at: c.at, n: (s?.n ?? 0) + 1 }))}
                      disabled={!mod.youtubeId}
                      style={{
                        width: '100%', display: 'flex', gap: 14, alignItems: 'baseline',
                        padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left',
                        background: seek?.at === c.at ? C.blueTint : 'transparent',
                        cursor: mod.youtubeId ? 'pointer' : 'default',
                        fontFamily: BODY, fontSize: 14.5, color: C.ink,
                      }}
                    >
                      <span style={{
                        color: C.blue, fontVariantNumeric: 'tabular-nums', minWidth: 42, fontSize: 13.5,
                      }}>
                        {formatTime(c.at)}
                      </span>
                      <span>{c.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {resources.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Free downloads for this module</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {resources.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/free/${r.slug}`}
                    style={{
                      display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16,
                      border: `1px solid ${C.line}`, borderRadius: 12, textDecoration: 'none',
                    }}
                  >
                    <span style={{
                      width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: C.blueTint,
                      color: C.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Download size={17} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.ink }}>{r.name}</span>
                      <span style={{ display: 'block', marginTop: 3, fontSize: 13.5, lineHeight: 1.45, color: C.ink2 }}>
                        {r.promise}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside style={{ display: 'grid', gap: 16, position: isMobile ? 'static' : 'sticky', top: 24 }}>
          {list}
          <a
            href="/community?src=classroom"
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16,
              borderRadius: 14, border: `1px solid ${C.line}`, textDecoration: 'none', color: C.ink,
            }}
          >
            <Users size={18} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>
              <strong>Stuck on something?</strong>{' '}
              <span style={{ color: C.ink2 }}>
                Ask in the free community. Other grads working the same market, and I answer personally.
              </span>
            </span>
          </a>
        </aside>
      </div>
    </div>
  );
}
