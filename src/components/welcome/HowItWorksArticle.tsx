import React from 'react';
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
 * Copy is the founder's article, trimmed for a two minute read. Sentences that
 * carry the weight sit on a line of their own, at a larger size, because
 * they land harder that way than inside a paragraph.
 *
 * Screenshots are the real client messages under public/Assets/testimonials.
 * Names are redacted in the source images and are not restored here.
 */

export const HOW_IT_WORKS_ID = 'how-it-works';

const MSG = (n: string) => encodeURI(`/Assets/testimonials/messages/${n}.png`);

interface CloudItem { src: string; alt: string }

const PAIN_CLOUD: CloudItem[] = [
  { src: MSG('8'), alt: 'A message: this is what I always get, I am really losing out on hope, with a rejection email attached' },
  { src: MSG('6'), alt: 'A message: I need a solution, I have been in a job I dislike for more than two years' },
  { src: MSG('7'), alt: 'A message: contemplating whether I chose the right degree' },
];

const WIN_CLOUD: CloudItem[] = [
  { src: MSG('2'), alt: 'A message: I have got a job as a Technical BA, thank you for your support' },
  { src: MSG('3'), alt: 'A message from a client' },
  { src: MSG('10'), alt: 'A message from a client' },
];

const STEPS = [
  { t: 'Optimise your resume', d: 'Set up your core profile once. We clean up and position your resume before you start applying.' },
  { t: 'Find relevant jobs', d: 'Browse suitable roles and move into the application workflow in one click.' },
  { t: 'Check eligibility', d: 'Know whether the role is worth your time before you invest in the application.' },
  { t: 'Build the application', d: 'A role-specific resume and cover letter, written from the job description and your profile.' },
  { t: 'Evaluate it like a hiring manager', d: 'Review it before you send it. Fix the obvious weaknesses instead of blindly pressing Apply.' },
  { t: 'Contact the right person', d: 'A relevant recruiter, hiring manager or team member, with a personalised message already drafted.' },
  { t: 'Track and follow up', d: 'Every application is tracked. After seven days you are reminded to follow up, with the message ready.' },
] as const;

const FLOW = ['Find', 'Check', 'Tailor', 'Evaluate', 'Apply', 'Reach out', 'Follow up'] as const;

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

const section: React.CSSProperties = { marginTop: 'clamp(44px, 7vw, 68px)' };

function Lines({ children, style }: { children: string[]; style?: React.CSSProperties }) {
  return (
    <div style={{ margin: '0 0 22px' }}>
      {children.map(t => <p key={t} style={{ ...line, ...style }}>{t}</p>)}
    </div>
  );
}

function Cloud({ items, caption }: { items: CloudItem[]; caption: string }) {
  return (
    <figure style={{ margin: 'clamp(30px, 5vw, 44px) 0 0' }}>
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
        {items.map(it => (
          <div
            key={it.src}
            style={{
              width: '100%', maxWidth: 520, borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${colors.borderDefined}`, background: '#fff',
              boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 10px 24px -16px rgba(26,24,20,0.35)',
            }}
          >
            <img src={it.src} alt={it.alt} loading="lazy" draggable={false} style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>
        ))}
      </div>
      <figcaption style={{ fontFamily: T.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 14 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

export function HowItWorksArticle({ onStart }: { onStart: () => void }) {
  return (
    <article
      id={HOW_IT_WORKS_ID}
      aria-label="How Aussie Grad Careers works"
      style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(48px, 8vw, 88px) 0 clamp(56px, 8vw, 96px)' }}
    >
      <style>{`
        .hiw-step { display: grid; grid-template-columns: 34px 1fr; gap: 14px; padding: 18px 0; border-top: 1px solid ${colors.borderWhisper}; }
        .hiw-step:first-child { border-top: none; }
        .hiw-flow { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin: 26px 0 30px; padding: 0; list-style: none; }
        .hiw-start:hover { background: ${colors.accentPetrolHover} !important; }
      `}</style>

      <Eyebrow>2 MIN READ</Eyebrow>
      <h2 style={{ ...h2, fontSize: 'clamp(30px, 5.4vw, 44px)', lineHeight: 1.1, marginBottom: 34 }}>
        Stop applying harder. Start running a system.
      </h2>

      <p style={prose}>Getting your first job in Australia as a migrant can feel like a black box.</p>
      <Lines>{['You apply.', 'You wait.', 'You get a generic rejection, or worse, nothing.']}</Lines>

      <p style={prose}>Then you start guessing.</p>
      <Lines style={{ fontWeight: 500 }}>{['Did my resume pass the ATS?', 'Was my English good enough?', 'Was it my accent, or my lack of Australian experience?']}</Lines>
      <p style={{ ...line, color: colors.accentPetrol }}>Maybe. But you usually never find out.</p>

      <Cloud items={PAIN_CLOUD} caption="Real messages and emails, names removed." />

      <div style={section}>
        <h3 style={h2}>The market is not built to give you feedback.</h3>
        <p style={prose}>One role can attract hundreds of applications. Many are cut for missing the basics.</p>
        <p style={prose}>
          The rest are compared on relevance, positioning, timing, referrals, and sometimes simply who
          got noticed. Even a strong candidate can miss out.
        </p>
        <div style={{ marginTop: 26 }}>
          <p style={{ ...line, margin: 0 }}>So the answer is not to apply harder.</p>
          <p style={{ ...line, color: colors.accentPetrol }}>It is to build a better system.</p>
        </div>
      </div>

      <div style={section}>
        <h3 style={h2}>Two levers you control.</h3>
        <p style={prose}>Hiring happens three ways:</p>
        <Lines style={{ fontWeight: 500 }}>{['You apply.', 'Someone refers you.', 'A company finds you.']}</Lines>
        <p style={prose}>For most people breaking into the Australian market, the first two are yours to pull.</p>
        <p style={prose}>
          Your job is to get a high-quality application in front of the right employer, then give the
          right person a reason to notice you.
        </p>
      </div>

      <div style={section}>
        <h3 style={h2}>That is what Aussie Grad Careers automates.</h3>
        <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.t} className="hiw-step">
              <span style={{
                width: 34, height: 34, borderRadius: 99, display: 'grid', placeItems: 'center',
                background: 'rgba(45,90,110,0.08)', color: colors.accentPetrol,
                fontFamily: T.body, fontSize: 13, fontWeight: 700,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 17, fontWeight: 600, color: colors.textPrimary }}>{s.t}</span>
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 15.5, lineHeight: 1.55, color: colors.textSecondary, marginTop: 3 }}>{s.d}</span>
              </span>
            </li>
          ))}
        </ol>

        <div style={{ display: 'grid', gap: 18, margin: '30px 0 0' }}>
          <MockWindow label="Job fit check"><MockFitReport /></MockWindow>
          <MockWindow label="Your tracker"><MockTracker /></MockWindow>
        </div>
      </div>

      <div style={section}>
        <h3 style={h2}>The result: a repeatable workflow.</h3>
        <p style={prose}>
          Instead of an hour fighting with ChatGPT and wondering what to do next, you run the same loop
          every time.
        </p>
        <ol className="hiw-flow" aria-label="The workflow">
          {FLOW.map((f, i) => (
            <React.Fragment key={f}>
              <li style={{
                padding: '8px 14px', borderRadius: 99, background: colors.bgAlt,
                border: `1px solid ${colors.borderDefined}`,
                fontFamily: T.body, fontSize: 14, fontWeight: 600, color: colors.textPrimary,
              }}>{f}</li>
              {i < FLOW.length - 1 && <ArrowRight size={14} aria-hidden style={{ color: colors.accentGold }} />}
            </React.Fragment>
          ))}
        </ol>
        <p style={line}>Once your profile is set up, a high-quality application can take about five minutes.</p>
        <p style={{ ...prose, marginTop: 14 }}>The point is not to apply to everything.</p>
        <p style={prose}>
          It is to make more high-quality attempts, in less time, while more of the right people learn
          you are interested.
        </p>

        <Cloud items={WIN_CLOUD} caption="Messages from people we have worked with, names removed." />
      </div>

      <blockquote style={{
        margin: 'clamp(44px, 7vw, 68px) 0 44px', padding: '4px 0 4px 20px', borderLeft: `3px solid ${colors.accentGold}`,
        fontFamily: T.display, fontStyle: 'italic', fontSize: 'clamp(20px, 3vw, 25px)', lineHeight: 1.4, color: colors.accentPetrol,
      }}>
        Do not build your job search around motivation.<br />
        Build it around a system you can run even on your worst day.
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
    </article>
  );
}
