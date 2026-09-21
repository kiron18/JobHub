import React from 'react';
import { ArrowRight, ArrowUp, Check } from 'lucide-react';
import { colors, type as T } from '../landing/tokens';
import { Eyebrow } from '../landing/shared/Eyebrow';
import { MockWindow, MockFitReport, MockTracker } from '../landing/pricing/AppMock';

/**
 * The "Find out how" article, shown under the front door's fold.
 *
 * It replaces a link that opened /pricing in a new tab. The job here is trust
 * and sign-ups, not payment, so there is no price, no plan and no checkout
 * anywhere in it: it argues, shows the proof, and hands the reader back to the
 * dropzone at the top of the same page.
 *
 * Copy is the founder's article, trimmed for a two minute read (about 470
 * words). Cut on purpose: the "hiring happens through three paths" numbered
 * list became one line, the follow-up response rate table from /pricing is not
 * repeated (its percentages do not match its own counts), and the closing
 * "use the time you save to enjoy Australia" paragraph is gone.
 *
 * Screenshots are the real client messages under public/Assets/testimonials.
 * Names are redacted in the source images and are not restored here.
 */

export const HOW_IT_WORKS_ID = 'how-it-works';

const MSG = (n: string) => encodeURI(`/Assets/testimonials/messages/${n}.png`);

interface CloudItem {
  src: string;
  /** CSS grid-column, on a 12 column grid. */
  col: string;
  row: number;
  rotate: number;
  /** Pulls a card up under the one above it so the set overlaps like a pile. */
  pull?: number;
  /** Shows only the middle band of an image that has a lot of empty page around the message. */
  crop?: string;
  alt: string;
}

/* The pile of rejections and low moments. 31 (11) is a full 1920x1080 grab of
   an inbox with the message in the middle third, so it is cropped to that band. */
const PAIN_CLOUD: CloudItem[] = [
  { src: MSG('31 (11)'), col: '1 / 9', row: 1, rotate: -2, crop: '1920 / 800', alt: 'A generic rejection email: due to the high volume of applications we are only able to respond to successful applicants' },
  { src: MSG('8'), col: '9 / 13', row: 1, rotate: 3, alt: 'A message: this is what I always get, I am really losing out on hope, with a rejection email attached' },
  { src: MSG('6'), col: '3 / 12', row: 2, rotate: 1.5, pull: 4, alt: 'A message: I need a solution, I have been in a job I dislike for more than two years' },
  { src: MSG('7'), col: '1 / 10', row: 3, rotate: -1, pull: 4, alt: 'A message: contemplating whether I chose the right degree' },
];

const WIN_CLOUD: CloudItem[] = [
  { src: MSG('2'), col: '1 / 9', row: 1, rotate: -2, alt: 'A message: I have got a job as a Technical BA, thank you for your support' },
  { src: MSG('3'), col: '5 / 13', row: 2, rotate: 2, pull: 4, alt: 'A message from a client' },
  { src: MSG('10'), col: '1 / 10', row: 3, rotate: 1, pull: 4, alt: 'A message from a client' },
  { src: MSG('5'), col: '4 / 13', row: 4, rotate: -1.5, pull: 4, alt: 'A message from a client' },
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
  fontFamily: T.reading, fontSize: 17, lineHeight: 1.7, color: colors.textInk, margin: '0 0 18px',
};

const h2: React.CSSProperties = {
  fontFamily: T.display, fontWeight: 600, fontSize: 'clamp(22px, 3.4vw, 28px)', lineHeight: 1.2,
  letterSpacing: '-0.01em', color: colors.textPrimary, margin: '0 0 16px',
};

function Cloud({ items, caption }: { items: CloudItem[]; caption: string }) {
  return (
    <figure className="hiw-cloud" style={{ margin: '28px 0 34px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', alignItems: 'center', padding: '6px 0' }}>
        {items.map(it => (
          <div
            key={it.src}
            className="hiw-card"
            style={{
              gridColumn: it.col, gridRow: it.row,
              marginTop: it.pull ? -it.pull : 0,
              transform: `rotate(${it.rotate}deg)`,
              borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${colors.borderDefined}`,
              background: colors.bgSurface,
              boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 12px 28px -16px rgba(26,24,20,0.4)',
              aspectRatio: it.crop,
            }}
          >
            <img
              src={it.src} alt={it.alt} loading="lazy" draggable={false}
              style={{ display: 'block', width: '100%', height: it.crop ? '100%' : 'auto', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
      <figcaption style={{ fontFamily: T.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 14 }}>
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
      style={{
        marginTop: 28, background: colors.bgSurface,
        border: '1px solid rgba(26, 24, 20, 0.28)', borderRadius: 22,
        padding: 'clamp(26px, 5vw, 48px) clamp(20px, 5vw, 44px)',
        boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 26px 60px -34px rgba(26,24,20,0.45)',
        scrollMarginTop: 24,
      }}
    >
      <style>{`
        .hiw-card { transition: transform .25s cubic-bezier(0.25,1,0.5,1), box-shadow .25s ease; position: relative; }
        @media (hover: hover) { .hiw-card:hover { z-index: 2; transform: rotate(0deg) scale(1.03) !important; } }
        .hiw-step { display: grid; grid-template-columns: 34px 1fr; gap: 14px; padding: 16px 0; border-top: 1px solid ${colors.borderWhisper}; }
        .hiw-step:first-child { border-top: none; }
        .hiw-flow { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 8px; margin: 22px 0 6px; padding: 0; list-style: none; }
        .hiw-start:hover { background: ${colors.accentPetrolHover} !important; }
        @media (prefers-reduced-motion: reduce) { .hiw-card { transition: none; } }
      `}</style>

      <Eyebrow>2 MIN READ</Eyebrow>
      <h2 style={{ ...h2, fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.1, marginBottom: 26 }}>
        Stop applying harder. Start running a system.
      </h2>

      <p style={prose}>
        Getting your first job in Australia as a migrant can feel like a black box. You apply. You wait.
        You get a generic rejection, or worse, nothing.
      </p>
      <p style={prose}>
        Then you start guessing. Did my resume pass the ATS? Was my English good enough? Was it my
        accent, or my lack of Australian experience? Maybe. But you usually never find out.
      </p>

      <Cloud
        items={PAIN_CLOUD}
        caption="Real messages and emails, names removed."
      />

      <h3 style={h2}>The market is not built to give you feedback.</h3>
      <p style={prose}>
        One role can attract hundreds of applications. Many are cut for missing the basics. The rest
        are compared on relevance, positioning, timing, referrals, and sometimes simply who got
        noticed. Even a strong candidate can miss out.
      </p>
      <p style={{ ...prose, fontWeight: 600, color: colors.textPrimary }}>
        So the answer is not to apply harder. It is to build a better system.
      </p>

      <h3 style={{ ...h2, marginTop: 34 }}>Two levers you control.</h3>
      <p style={prose}>
        Hiring happens three ways: you apply, someone refers you, or a company finds you. For most
        people breaking into the Australian market, the first two are yours to pull. Your job is to
        get a high-quality application in front of the right employer, then give the right person a
        reason to notice you.
      </p>

      <h3 style={{ ...h2, marginTop: 34 }}>That is what Aussie Grad Careers automates.</h3>
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
              <span style={{ display: 'block', fontFamily: T.body, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>{s.t}</span>
              <span style={{ display: 'block', fontFamily: T.body, fontSize: 14.5, lineHeight: 1.55, color: colors.textSecondary, marginTop: 3 }}>{s.d}</span>
            </span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gap: 18, margin: '26px 0 8px' }}>
        <MockWindow label="Job fit check"><MockFitReport /></MockWindow>
        <MockWindow label="Your tracker"><MockTracker /></MockWindow>
      </div>

      <h3 style={{ ...h2, marginTop: 34 }}>The result: a repeatable workflow.</h3>
      <p style={prose}>
        Instead of an hour fighting with ChatGPT and wondering what to do next, you run the same
        loop every time.
      </p>
      <ol className="hiw-flow" aria-label="The workflow">
        {FLOW.map((f, i) => (
          <React.Fragment key={f}>
            <li style={{
              padding: '8px 13px', borderRadius: 99, background: colors.bgAlt,
              border: `1px solid ${colors.borderDefined}`,
              fontFamily: T.body, fontSize: 13.5, fontWeight: 600, color: colors.textPrimary,
            }}>{f}</li>
            {i < FLOW.length - 1 && <ArrowRight size={14} aria-hidden style={{ color: colors.accentGold }} />}
          </React.Fragment>
        ))}
      </ol>
      <p style={{ ...prose, marginTop: 18 }}>
        Once your profile is set up, a high-quality application can take about five minutes. The point
        is not to apply to everything. It is to make more high-quality attempts, in less time, while
        more of the right people learn you are interested.
      </p>

      <Cloud
        items={WIN_CLOUD}
        caption="Messages from people we have worked with, names removed."
      />

      <blockquote style={{
        margin: '8px 0 28px', padding: '4px 0 4px 18px', borderLeft: `3px solid ${colors.accentGold}`,
        fontFamily: T.display, fontStyle: 'italic', fontSize: 'clamp(18px, 2.6vw, 21px)', lineHeight: 1.45, color: colors.accentPetrol,
      }}>
        Do not build your job search around motivation. Build it around a system you can run even on your worst day.
      </blockquote>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          className="hiw-start"
          onClick={onStart}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, minHeight: 48, padding: '0 26px',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            background: colors.accentPetrol, color: colors.textOnDeep,
            fontFamily: T.body, fontSize: 15.5, fontWeight: 600,
            boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
            transition: 'background .18s ease',
          }}
        >
          <ArrowUp size={17} aria-hidden /> Upload your resume
        </button>
        <p style={{ fontFamily: T.body, fontSize: 13, color: colors.textMuted, margin: '12px 0 0', display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
          <Check size={14} aria-hidden style={{ color: colors.success }} /> See your rebuilt resume before you sign up.
        </p>
      </div>
    </article>
  );
}
