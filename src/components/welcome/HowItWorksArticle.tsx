import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check } from 'lucide-react';
import { colors, type as T } from '../landing/tokens';
import { Eyebrow } from '../landing/shared/Eyebrow';
import { MockWindow, MockFitReport, MockTracker } from '../landing/pricing/AppMock';

/**
 * The "Find out how" article, shown under the front door's fold.
 *
 * It lives on a plain white band (see Shell's `footer`), not in a card over
 * the testimonial marquee. The job here is trust and sign-ups, not payment, so
 * there is no price, no plan and no checkout anywhere in it: it argues, shows
 * the proof, and hands the reader back to the dropzone at the top of the page.
 *
 * Copy is the founder's article, word for word, with two exceptions: the
 * "Contact the right person" and "Track and follow up" steps drop their
 * flourish lines ("Then you repeat.", "Application + outreach.") because
 * those steps now render as compact map cards, not paragraphs, and a card
 * is not the place for a rhythm line.
 *
 * The testimonials are a side rail next to the text that raises them, not a
 * stacked block the reader has to scroll past. A page whose only job is
 * trust and comprehension should not cost more scrolling than the argument
 * needs; the images support the copy from beside it instead of interrupting
 * it. On a phone, where there is no side to put them, they become a short
 * horizontal strip the reader can flick through instead of a wall of full
 * width cards.
 *
 * Screenshots are the real client messages under public/Assets/testimonials.
 * Names are redacted in the source images and are not restored here.
 */

export const HOW_IT_WORKS_ID = 'how-it-works';

const MSG = (n: string) => encodeURI(`/Assets/testimonials/messages/${n}.png`);

/** Comfortable reading width for a paragraph. Also what the text track next
 *  to a testimonial rail resolves to, since 900 (article) - 240 (rail) - 36
 *  (gap) lands close enough to this that the two layouts read as one size. */
const READ = 660;

interface RailItem {
  src: string;
  alt: string;
  /** Shows only the middle band of an image with a lot of empty page around the message. */
  crop?: string;
  rotate: number;
}

/* 31 (11) is a full 1920x1080 grab of an inbox with the message in the middle
   third, so it is cropped to that band. */
const PAIN_RAIL: RailItem[] = [
  { src: MSG('31 (11)'), crop: '1920 / 800', rotate: -1.5, alt: 'A generic rejection email: due to the high volume of applications we are only able to respond to successful applicants' },
  { src: MSG('8'), rotate: 1.5, alt: 'A message: this is what I always get, I am really losing out on hope, with a rejection email attached' },
  { src: MSG('6'), rotate: -1, alt: 'A message: I need a solution, I have been in a job I dislike for more than two years' },
  { src: MSG('7'), rotate: 1, alt: 'A message: contemplating whether I chose the right degree' },
];

/* The Inlight call screenshot (image 5) dropped: it read as an orphaned
   testimonial once the layout stopped needing a fourth item to balance a
   two-column grid. */
const WIN_RAIL: RailItem[] = [
  { src: MSG('2'), rotate: -1.5, alt: 'A message: I have got a job as a Technical BA, thank you for your support' },
  { src: MSG('3'), rotate: 1, alt: 'A message from a client' },
  { src: MSG('10'), rotate: -1, alt: 'A message from a client' },
];

const STEPS = [
  { t: 'Optimise your resume', d: 'Set up your core profile once. We help you clean up and position your resume before you start applying.' },
  { t: 'Find relevant jobs', d: 'Browse suitable roles and move into the application workflow with a single click.' },
  { t: 'Check eligibility', d: 'Quickly determine whether the role is worth your time before you invest in the application.' },
  { t: 'Build the application', d: 'Generate a role-specific resume and cover letter based on the job description and your profile.' },
  { t: 'Evaluate it like a hiring manager', d: 'Review the application before sending it. Fix obvious weaknesses instead of blindly pressing Apply.' },
  { t: 'Contact the right person', d: 'After applying, the system helps identify a relevant recruiter, hiring manager or team member and drafts a personalised outreach message.' },
  { t: 'Track and follow up', d: "Every application is tracked. After seven days, you're reminded to follow up, with a message already prepared." },
] as const;

/* Two of the seven steps merge into one stop each, so the whole workflow can
   sit on one line instead of wrapping to a stray second row. */
const FLOW = ['Find & check', 'Tailor', 'Evaluate', 'Apply', 'Reach out & follow-up'] as const;

const prose: React.CSSProperties = {
  fontFamily: T.reading, fontSize: 18, lineHeight: 1.65, color: colors.textInk, margin: '0 0 14px',
};

/** A sentence that earns its own line. */
const line: React.CSSProperties = {
  fontFamily: T.display, fontWeight: 600, fontSize: 'clamp(21px, 3.4vw, 26px)', lineHeight: 1.3,
  letterSpacing: '-0.005em', color: colors.textPrimary, margin: '0 0 8px',
};

const h2: React.CSSProperties = {
  fontFamily: T.display, fontWeight: 600, fontSize: 'clamp(24px, 4vw, 32px)', lineHeight: 1.2,
  letterSpacing: '-0.01em', color: colors.textPrimary, margin: '0 0 18px',
};

const section: React.CSSProperties = { marginTop: 'clamp(44px, 7vw, 68px)', maxWidth: READ, marginLeft: 'auto', marginRight: 'auto' };

function Lines({ children, style }: { children: string[]; style?: React.CSSProperties }) {
  return (
    <div style={{ margin: '0 0 22px' }}>
      {children.map(t => <p key={t} style={{ ...line, ...style }}>{t}</p>)}
    </div>
  );
}

/** The pile of screenshots beside the text that raises them, not below it. */
function TestimonialRail({ items }: { items: RailItem[] }) {
  return (
    <div className="hiw-rail-images">
      {items.map(it => (
        <div
          key={it.src}
          className="hiw-rail-card"
          style={{ transform: `rotate(${it.rotate}deg)`, aspectRatio: it.crop }}
        >
          <img
            src={it.src} alt={it.alt} loading="lazy" draggable={false}
            style={{ display: 'block', width: '100%', height: it.crop ? '100%' : 'auto', objectFit: 'cover' }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The seven-step list as a loose map instead of a stacked ledger.
 *
 * Each step is a small card, offset up or down and tilted a little so the
 * set reads as scattered islands rather than a grid, and a single dotted
 * path threads through their centres in order, like a route drawn across a
 * map. The path is real geometry, not decoration laid over guessed
 * positions: it is measured off the cards' own rendered rects, so it still
 * lines up after a resize, a font swap, or a line-wrap changes a card's
 * height.
 */
function JourneyMap({ steps }: { steps: readonly { t: string; d: string }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [path, setPath] = useState('');
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const points = cardRefs.current
        .filter((el): el is HTMLDivElement => !!el)
        .map(el => {
          const r = el.getBoundingClientRect();
          return { x: r.left - cRect.left + r.width / 2, y: r.top - cRect.top + r.height / 2 };
        });
      if (points.length < 2) return;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const dx = (p1.x - p0.x) * 0.5;
        d += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      setPath(d);
      setBox({ w: cRect.width, h: cRect.height });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [steps.length]);

  return (
    <div ref={containerRef} className="hiw-map">
      <svg
        width="100%" height="100%" viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <path d={path} fill="none" stroke={colors.accentGold} strokeWidth={2} strokeDasharray="1 8" strokeLinecap="round" opacity={0.55} />
      </svg>
      <div className="hiw-map-cards">
        {steps.map((s, i) => (
          <div
            key={s.t}
            ref={el => { cardRefs.current[i] = el; }}
            className="hiw-map-card"
            style={{
              '--lift': `${MAP_LIFT[i % MAP_LIFT.length]}px`,
              '--tilt': `${(i % 2 === 0 ? -1 : 1) * (1.5 + (i % 3))}deg`,
            } as React.CSSProperties}
          >
            <span className="hiw-map-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="hiw-map-title">{s.t}</span>
            <span className="hiw-map-desc">{s.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MAP_LIFT = [0, -20, 12, -10, 18, -16, 8];

export function HowItWorksArticle({ onStart }: { onStart: () => void }) {
  return (
    <article
      id={HOW_IT_WORKS_ID}
      aria-label="How Aussie Grad Careers works"
      style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(48px, 8vw, 88px) 0 clamp(56px, 8vw, 96px)' }}
    >
      <style>{`
        .hiw-step { display: grid; grid-template-columns: 34px 1fr; gap: 14px; padding: 18px 0; border-top: 1px solid ${colors.borderWhisper}; }
        .hiw-step:first-child { border-top: none; }
        /* Always one line: the row never wraps. Below its comfortable width it
           scrolls instead, faded at both edges so the fade itself says there
           is more, rather than an unlabelled row that just stops mid-pill. */
        .hiw-flow {
          display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;
          gap: clamp(3px, 1.2vw, 8px); margin: 26px 0 30px; padding: 0 2px 6px; list-style: none;
          overflow-x: auto; scrollbar-width: none;
          -webkit-mask-image: linear-gradient(to right, transparent, black 18px, black calc(100% - 18px), transparent);
          mask-image: linear-gradient(to right, transparent, black 18px, black calc(100% - 18px), transparent);
        }
        .hiw-flow::-webkit-scrollbar { display: none; }
        .hiw-start:hover { background: ${colors.accentPetrolHover} !important; }

        .hiw-rail { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
        .hiw-rail-text { max-width: ${READ}px; }
        .hiw-rail-images {
          display: flex; flex-direction: row; gap: 12px; overflow-x: auto;
          padding-bottom: 6px; scrollbar-width: none;
        }
        .hiw-rail-images::-webkit-scrollbar { display: none; }
        .hiw-rail-card {
          flex: 0 0 auto; width: 150px; border-radius: 10px; overflow: hidden;
          border: 1px solid ${colors.borderDefined}; background: #fff;
          box-shadow: 0 1px 2px rgba(26,24,20,0.05), 0 8px 18px -14px rgba(26,24,20,0.35);
        }
        @media (min-width: 860px) {
          .hiw-rail { grid-template-columns: 1fr 240px; gap: 36px; }
          .hiw-rail-images { flex-direction: column; overflow-x: visible; position: sticky; top: 28px; }
          .hiw-rail-card { width: 100%; }
        }

        .hiw-map { position: relative; padding: 30px 4px 36px; }
        .hiw-map-cards { display: flex; flex-wrap: wrap; gap: 26px 20px; position: relative; z-index: 1; }
        .hiw-map-card {
          flex: 1 1 160px; max-width: 210px; min-width: 150px;
          background: #fff; border: 1px solid ${colors.borderDefined}; border-radius: 14px;
          padding: 16px 15px; display: flex; flex-direction: column; gap: 4px;
          box-shadow: 0 1px 2px rgba(26,24,20,0.05), 0 12px 22px -16px rgba(26,24,20,0.35);
          transform: translateY(var(--lift)) rotate(var(--tilt));
          transition: transform .2s ease, box-shadow .2s ease;
        }
        @media (hover: hover) {
          .hiw-map-card:hover { transform: translateY(calc(var(--lift) - 4px)) rotate(0deg); box-shadow: 0 4px 8px rgba(26,24,20,0.06), 0 18px 32px -16px rgba(26,24,20,0.4); }
        }
        .hiw-map-num {
          width: 26px; height: 26px; border-radius: 99px; display: grid; place-items: center;
          background: rgba(45,90,110,0.08); color: ${colors.accentPetrol};
          font-family: ${T.body}; font-size: 11.5px; font-weight: 700; margin-bottom: 4px;
        }
        .hiw-map-title { font-family: ${T.body}; font-size: 15px; font-weight: 600; color: ${colors.textPrimary}; line-height: 1.3; }
        .hiw-map-desc { font-family: ${T.body}; font-size: 13px; line-height: 1.5; color: ${colors.textSecondary}; }
        @media (prefers-reduced-motion: reduce) { .hiw-map-card { transition: none; } }
      `}</style>

      <div style={{ maxWidth: READ, margin: '0 auto' }}>
        <Eyebrow>2 MIN READ</Eyebrow>
        <h2 style={{ ...h2, fontSize: 'clamp(30px, 5.4vw, 44px)', lineHeight: 1.1, marginBottom: 34 }}>
          Stop applying harder. Start running a system.
        </h2>
      </div>

      <div className="hiw-rail" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="hiw-rail-text">
          <p style={prose}>Getting your first job in Australia as a migrant can feel like a black box.</p>
          <Lines>{['You apply.', 'You wait.', 'You get a generic rejection.', 'Or worse, you hear nothing.']}</Lines>

          <p style={prose}>Then you start guessing.</p>
          <Lines style={{ fontWeight: 500 }}>{['Did my resume pass the ATS?', 'Was I qualified?', 'Was my English good enough?', 'Was it my nationality?', 'My accent?', 'My lack of Australian experience?']}</Lines>
          <Lines style={{ color: colors.accentPetrol }}>{['Maybe.', "But you usually don't know.", "And that's the problem."]}</Lines>
        </div>
        <TestimonialRail items={PAIN_RAIL} />
      </div>

      <div style={section}>
        <h3 style={h2}>The job market is not designed to give you feedback.</h3>
        <p style={prose}>Hiring managers and recruiters can receive hundreds of applications for a single role.</p>
        <p style={prose}>
          Many applications are eliminated because they don't meet basic requirements. The remaining
          candidates are compared on experience, relevance, positioning, timing, referrals, and sometimes
          simply who happened to get noticed.
        </p>
        <p style={prose}>That means even a genuinely strong candidate can miss out.</p>
        <p style={{ ...prose, marginTop: 26 }}>So the answer isn't simply:</p>
        <p style={{ ...line, fontSize: 'clamp(24px, 4vw, 30px)' }}>"Apply harder."</p>
        <p style={{ ...line, color: colors.accentPetrol }}>It's to build a better system.</p>
      </div>

      <div style={section}>
        <h3 style={h2}>Most hiring happens through three paths</h3>
        <Lines>{['1. You apply directly.', '2. Someone refers you.', '3. A company finds you.']}</Lines>
        <p style={prose}>
          For most people trying to break into the Australian market, the first two are the levers you
          can actively control.
        </p>
        <p style={prose}>That means your job is simple:</p>
        <p style={{ ...line, color: colors.accentPetrol, lineHeight: 1.35 }}>
          Get a high-quality application in front of the right employer, then create a reason for the
          right person to notice you.
        </p>
      </div>

      <div style={{ ...section, maxWidth: 900 }}>
        <div style={{ maxWidth: READ, margin: '0 auto' }}>
          <h3 style={h2}>That's exactly what Aussie Grad Careers automates.</h3>
        </div>
        <JourneyMap steps={STEPS} />

        <div style={{ display: 'grid', gap: 18, margin: '10px auto 0', maxWidth: READ }}>
          <MockWindow label="Job fit check"><MockFitReport /></MockWindow>
          <MockWindow label="Your tracker"><MockTracker /></MockWindow>
        </div>
      </div>

      <div style={section}>
        <h3 style={h2}>The result?</h3>
        <p style={prose}>
          Instead of spending an hour fighting with ChatGPT, rewriting prompts and wondering what to do
          next, you have a repeatable workflow.
        </p>
        <ol className="hiw-flow" aria-label="The workflow">
          {FLOW.map((f, i) => (
            <React.Fragment key={f}>
              <li style={{
                flex: '0 0 auto',
                padding: 'clamp(5px, 1.4vw, 8px) clamp(8px, 2.4vw, 14px)', borderRadius: 99, background: colors.bgAlt,
                border: `1px solid ${colors.borderDefined}`, whiteSpace: 'nowrap',
                fontFamily: T.body, fontSize: 'clamp(11px, 2.6vw, 14px)', fontWeight: 600, color: colors.textPrimary,
              }}>{f}</li>
              {i < FLOW.length - 1 && <ArrowRight size={13} aria-hidden style={{ flex: '0 0 auto', color: colors.accentGold }} />}
            </React.Fragment>
          ))}
        </ol>
        <p style={line}>A high-quality application can become a ~5-minute workflow once your profile is set up.</p>
        <p style={{ ...prose, marginTop: 14 }}>
          Do that consistently and your job search stops depending entirely on motivation.
        </p>
      </div>

      <div style={{ ...section, maxWidth: 900 }}>
        <div className="hiw-rail">
          <div className="hiw-rail-text">
            <h3 style={h2}>The point isn't to apply to everything.</h3>
            <p style={prose}>
              It's to make more high-quality attempts, in less time, while systematically increasing the
              number of people who know you're interested.
            </p>
            <p style={prose}>
              Use your saved time to build projects, improve your skills, meet people, or actually enjoy
              living in Australia.
            </p>
          </div>
          <TestimonialRail items={WIN_RAIL} />
        </div>
      </div>

      <div style={{ maxWidth: READ, margin: '0 auto' }}>
        <blockquote style={{
          margin: 'clamp(44px, 7vw, 68px) 0 44px', padding: '4px 0 4px 20px', borderLeft: `3px solid ${colors.accentGold}`,
          fontFamily: T.display, fontWeight: 600, fontSize: 'clamp(20px, 3vw, 25px)', lineHeight: 1.4, color: colors.accentPetrol,
        }}>
          Don't build your job search around motivation.<br />
          Build it around a system you can execute even on your worst day.
        </blockquote>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="hiw-start"
            onClick={onStart}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, minHeight: 50, padding: '0 28px',
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: colors.accentPetrol, color: colors.textOnDeep,
              fontFamily: T.body, fontSize: 16, fontWeight: 600,
              boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
              transition: 'background .18s ease',
            }}
          >
            <ArrowUp size={17} aria-hidden /> Upload your resume
          </button>
          <p style={{ fontFamily: T.body, fontSize: 13.5, color: colors.textMuted, margin: '12px 0 0', display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
            <Check size={14} aria-hidden style={{ color: colors.success }} /> See your rebuilt resume before you sign up.
          </p>
        </div>
      </div>
    </article>
  );
}
