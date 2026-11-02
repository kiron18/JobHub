import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, Hourglass, MailX, Send, VolumeX } from 'lucide-react';
import { colors, type as T } from '../landing/tokens';
import { Eyebrow } from '../landing/shared/Eyebrow';
import { MockWindow, MockFitReport, MockTracker } from '../landing/pricing/AppMock';
import { ACTION } from '../../lib/theme/warmTokens';

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
 * The testimonial screenshot rails are gone (Kiron, 2 Nov 2026): at rail
 * width nobody could read them. The pain is drawn instead, as a timeline of
 * what happens to an application and a figure thinking the questions that
 * follow it.
 */

export const HOW_IT_WORKS_ID = 'how-it-works';

/** Comfortable reading width for a paragraph. */
const READ = 660;

/** What happens to an application, left to right. The last stop has no end. */
const SILENCE = [
  { when: 'Day 1', t: 'You apply.', Icon: Send },
  { when: 'Days pass', t: 'You wait.', Icon: Hourglass },
  { when: 'Week 3', t: 'You get a generic rejection.', Icon: MailX },
  { when: 'Never', t: 'Or worse, you hear nothing.', Icon: VolumeX },
] as const;

const GUESSES = [
  'Did my resume pass the ATS?',
  'Was I qualified?',
  'Was my English good enough?',
  'Was it my nationality?',
  'My accent?',
  'My lack of Australian experience?',
] as const;

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

/**
 * An application's life, left to right. Each stop's connector runs to the
 * next one; the last stop's runs off the edge and fades, because hearing
 * nothing has no end point.
 */
function SilenceTimeline() {
  return (
    <ol className="hiw-tl" aria-label="What happens to an application">
      {SILENCE.map(({ when, t, Icon }, i) => (
        <li key={t} className={`hiw-tl-stop${i === SILENCE.length - 1 ? ' is-last' : ''}`}>
          <span className="hiw-tl-when">{when}</span>
          <span className="hiw-tl-dot"><Icon size={19} strokeWidth={2} aria-hidden /></span>
          <span className="hiw-tl-t">{t}</span>
        </li>
      ))}
    </ol>
  );
}

/** Someone at their desk, chin on hand, looking up at the questions. */
function ThinkingFigure() {
  const ink = colors.textPrimary;
  return (
    <svg viewBox="0 0 160 150" width="176" height="165" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {/* shoulders */}
      <path d="M22 150 C 26 112, 50 98, 80 98 C 110 98, 134 112, 138 150 Z" fill={colors.bgAlt} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      {/* neck */}
      <path d="M72 82 L72 99 M88 82 L88 99" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
      {/* head, turned a little up and to the right */}
      <circle cx="80" cy="58" r="27" fill="#fff" stroke={ink} strokeWidth={2.5} />
      <path d="M54 52 C 56 30, 76 24, 92 30 C 102 34, 107 42, 107 52 C 98 42, 84 38, 70 42 C 63 44, 58 48, 54 52 Z" fill={ink} />
      {/* eyes up, brows knotted */}
      <circle cx="74" cy="56" r="2.4" fill={ink} />
      <circle cx="91" cy="55" r="2.4" fill={ink} />
      <path d="M68 50 L78 48.5 M87 47.5 L96 50" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      {/* a flat, unsure mouth */}
      <path d="M77 70 Q 82 68.5, 87 70.5" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      {/* forearm up in front of the chest, fist under the chin */}
      <path d="M98 150 C 96 130, 90 108, 86 92 L 102 88 C 108 106, 116 128, 124 150 Z" fill="#fff" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx="94" cy="86" rx="11" ry="8.5" fill="#fff" stroke={ink} strokeWidth={2.5} transform="rotate(-15 94 86)" />
      <path d="M86 84 Q 94 81, 102 84" fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

/** The questions, each in its own bubble, rising off the figure. */
function GuessingBubbles() {
  return (
    <div className="hiw-think">
      <ul className="hiw-bubbles" aria-label="The questions you start asking">
        {GUESSES.map((g, i) => (
          <li
            key={g}
            className="hiw-bubble"
            style={{
              '--tilt': `${(i % 2 === 0 ? -1 : 1) * (1 + (i % 3) * 0.75)}deg`,
              '--lift': `${BUBBLE_LIFT[i]}px`,
              '--delay': `${i * -0.9}s`,
              borderRadius: BUBBLE_SHAPE[i % BUBBLE_SHAPE.length],
            } as React.CSSProperties}
          >
            {g}
          </li>
        ))}
      </ul>
      <div className="hiw-trail" aria-hidden><span /><span /><span /></div>
      <ThinkingFigure />
    </div>
  );
}

const BUBBLE_LIFT = [0, 10, -6, 8, -4, 6];

/* Uneven radii, so each bubble is a soft blob rather than another pill. */
const BUBBLE_SHAPE = [
  '30px 26px 32px 24px / 26px 30px 24px 32px',
  '24px 32px 26px 30px / 30px 24px 32px 26px',
  '28px 28px 22px 32px / 24px 32px 28px 26px',
];

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

        /* The timeline. Each stop draws the connector to the next from its own
           dot's centre (half a column to the right, one column wide); the last
           one runs half a column into nothing and fades out. */
        .hiw-tl { display: grid; grid-template-columns: repeat(4, 1fr); list-style: none; margin: 30px 0 34px; padding: 0; }
        .hiw-tl-stop { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 0 4px; }
        .hiw-tl-stop::after {
          content: ''; position: absolute; top: calc(18px + 10px + 23px); left: 50%; width: 100%; height: 2px;
          background: ${colors.borderDefined}; z-index: 0;
        }
        .hiw-tl-stop.is-last::after {
          width: 50%; background: repeating-linear-gradient(to right, ${colors.borderDefined} 0 5px, transparent 5px 11px);
          -webkit-mask-image: linear-gradient(to right, black, transparent); mask-image: linear-gradient(to right, black, transparent);
        }
        .hiw-tl-when {
          height: 18px; font-family: ${T.body}; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; color: ${colors.textMuted}; white-space: nowrap;
        }
        .hiw-tl-dot {
          position: relative; z-index: 1; width: 46px; height: 46px; border-radius: 99px; display: grid; place-items: center;
          background: #fff; border: 2px solid ${colors.textPrimary}; color: ${colors.textPrimary};
        }
        .hiw-tl-stop:nth-child(3) .hiw-tl-dot { border-color: ${colors.accentGold}; color: ${colors.accentGold}; background: ${colors.accentGoldSoft}; }
        .hiw-tl-stop.is-last .hiw-tl-dot { border-style: dashed; border-color: ${colors.textMuted}; color: ${colors.textMuted}; }
        .hiw-tl-t {
          font-family: ${T.display}; font-weight: 600; font-size: clamp(14px, 2.6vw, 19px); line-height: 1.25;
          color: ${colors.textPrimary}; text-wrap: balance;
        }
        .hiw-tl-stop.is-last .hiw-tl-t { color: ${colors.textSecondary}; }

        /* The thinker. Bubbles float above, a trail of shrinking dots runs down
           to the head, the figure sits at the bottom, centred. */
        .hiw-think { display: flex; flex-direction: column; align-items: center; margin: 22px 0 30px; }
        .hiw-bubbles { display: flex; flex-wrap: wrap; justify-content: center; gap: 22px 12px; list-style: none; margin: 0; padding: 0; max-width: 620px; }
        .hiw-bubble {
          background: #fff; border: 1.5px solid ${colors.borderDefined}; padding: 12px 20px;
          font-family: ${T.display}; font-weight: 600; font-size: clamp(15px, 2.4vw, 18px); line-height: 1.3; color: ${colors.textPrimary};
          box-shadow: 0 1px 2px rgba(16, 24, 40,0.04), 0 10px 22px -16px rgba(16, 24, 40,0.35);
          transform: translateY(var(--lift)) rotate(var(--tilt));
          animation: hiw-bob 5.4s ease-in-out var(--delay) infinite alternate;
        }
        @keyframes hiw-bob {
          from { transform: translateY(var(--lift)) rotate(var(--tilt)); }
          to { transform: translateY(calc(var(--lift) - 6px)) rotate(calc(var(--tilt) * -0.5)); }
        }
        .hiw-trail { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 18px 0 4px; }
        .hiw-trail span { display: block; border-radius: 99px; background: #fff; border: 1.5px solid ${colors.borderDefined}; }
        .hiw-trail span:nth-child(1) { width: 16px; height: 16px; transform: translateX(14px); }
        .hiw-trail span:nth-child(2) { width: 11px; height: 11px; transform: translateX(22px); }
        .hiw-trail span:nth-child(3) { width: 7px; height: 7px; transform: translateX(26px); }
        /* Stacked one or two to a row on a phone, the lifts only make the gaps uneven. */
        @media (max-width: 560px) { .hiw-bubbles { gap: 14px 10px; } .hiw-bubble { --lift: 0px !important; } }
        @media (prefers-reduced-motion: reduce) { .hiw-bubble { animation: none; } }

        .hiw-map { position: relative; padding: 30px 4px 36px; }
        .hiw-map-cards { display: flex; flex-wrap: wrap; gap: 26px 20px; position: relative; z-index: 1; }
        .hiw-map-card {
          flex: 1 1 160px; max-width: 210px; min-width: 150px;
          background: #fff; border: 1px solid ${colors.borderDefined}; border-radius: 14px;
          padding: 16px 15px; display: flex; flex-direction: column; gap: 4px;
          box-shadow: 0 1px 2px rgba(16, 24, 40,0.05), 0 12px 22px -16px rgba(16, 24, 40,0.35);
          transform: translateY(var(--lift)) rotate(var(--tilt));
          transition: transform .2s ease, box-shadow .2s ease;
        }
        @media (hover: hover) {
          .hiw-map-card:hover { transform: translateY(calc(var(--lift) - 4px)) rotate(0deg); box-shadow: 0 4px 8px rgba(16, 24, 40,0.06), 0 18px 32px -16px rgba(16, 24, 40,0.4); }
        }
        .hiw-map-num {
          width: 26px; height: 26px; border-radius: 99px; display: grid; place-items: center;
          background: rgba(18,87,196,0.08); color: ${colors.accentPetrol};
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

      <div style={{ maxWidth: READ, margin: '0 auto' }}>
        <p style={prose}>
          Applying for your first job in Australia as a migrant feels like shouting into an empty room.
        </p>
        <p style={prose}>
          You keep showing up, keep putting yourself out there, keep sending applications into the world.
          Somewhere, you know there's someone who needs what you have to offer. But the absence of
          feedback is one of the most soul-crushing experiences you will have in your life.
        </p>
        <SilenceTimeline />

        <p style={prose}>Then you start guessing.</p>
        <GuessingBubbles />

        <Lines style={{ color: colors.accentPetrol }}>{['Maybe.']}</Lines>
        <p style={{ ...line, color: colors.accentPetrol, lineHeight: 1.35 }}>
          The reality is, different jobs rejected you for different reasons. And solving for the reason
          Job A rejected you doesn't fix your resume for Job B.
        </p>
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
        <p style={line}>You're already doing that.</p>
        <p style={{ ...line, color: colors.accentPetrol, lineHeight: 1.35, marginTop: 18 }}>
          It's to build a better system that helps you send out high-quality applications and outreach,
          consistently.
        </p>
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

      <div style={section}>
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
              ...ACTION,
              fontFamily: T.body, fontSize: 16, fontWeight: 600,
              boxShadow: '0 1px 2px rgba(16, 24, 40,0.06), 0 4px 14px rgba(18,87,196,0.18)',
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
