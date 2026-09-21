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
 * Copy is the founder's article, word for word. Sentences that
 * carry the weight sit on a line of their own, at a larger size, because
 * they land harder that way than inside a paragraph.
 *
 * Screenshots are the real client messages under public/Assets/testimonials.
 * Names are redacted in the source images and are not restored here.
 */

export const HOW_IT_WORKS_ID = 'how-it-works';

const MSG = (n: string) => encodeURI(`/Assets/testimonials/messages/${n}.png`);

interface CloudItem {
  src: string;
  alt: string;
  /** Spans both columns of the cloud. */
  wide?: boolean;
  /** Shows only the middle band of an image with a lot of empty page around the message. */
  crop?: string;
  rotate: number;
}

/* 31 (11) is a full 1920x1080 grab of an inbox with the message in the middle
   third, so it is cropped to that band. */
const PAIN_CLOUD: CloudItem[] = [
  { src: MSG('31 (11)'), wide: true, crop: '1920 / 800', rotate: -1, alt: 'A generic rejection email: due to the high volume of applications we are only able to respond to successful applicants' },
  { src: MSG('8'), rotate: 1.2, alt: 'A message: this is what I always get, I am really losing out on hope, with a rejection email attached' },
  { src: MSG('6'), rotate: -1.2, alt: 'A message: I need a solution, I have been in a job I dislike for more than two years' },
  { src: MSG('7'), wide: true, rotate: 0.6, alt: 'A message: contemplating whether I chose the right degree' },
];

const WIN_CLOUD: CloudItem[] = [
  { src: MSG('2'), wide: true, rotate: -0.8, alt: 'A message: I have got a job as a Technical BA, thank you for your support' },
  { src: MSG('3'), rotate: 1.2, alt: 'A message from a client' },
  { src: MSG('10'), rotate: -1.2, alt: 'A message from a client' },
  { src: MSG('5'), wide: true, rotate: 0.6, alt: 'A message from a client' },
];

const STEPS: { t: string; d: string[]; after?: string[] }[] = [
  { t: 'Optimise your resume', d: ['Set up your core profile once. We help you clean up and position your resume before you start applying.'] },
  { t: 'Find relevant jobs', d: ['Browse suitable roles and move into the application workflow with a single click.'] },
  { t: 'Check eligibility', d: ['Quickly determine whether the role is worth your time before you invest in the application.'] },
  { t: 'Build the application', d: ['Generate a role-specific resume and cover letter based on the job description and your profile.'] },
  { t: 'Evaluate it like a hiring manager', d: ['Review the application before sending it. Fix obvious weaknesses instead of blindly pressing Apply.'] },
  { t: 'Contact the right person', d: ['After applying, the system helps identify a relevant recruiter, hiring manager or team member and drafts a personalised outreach message.', 'Application + outreach.', 'Two actions working together.'] },
  { t: 'Track and follow up', d: ['Every application is tracked.', "After seven days, you're reminded to follow up, with a message already prepared.", 'Then you repeat.'] },
];

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, alignItems: 'center' }}>
        {items.map(it => (
          <div
            key={it.src}
            style={{
              gridColumn: it.wide ? '1 / -1' : undefined,
              transform: `rotate(${it.rotate}deg)`,
              borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${colors.borderDefined}`, background: '#fff',
              boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 10px 24px -16px rgba(26,24,20,0.35)',
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
      <figcaption style={{ fontFamily: T.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 16 }}>
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
      <Lines>{['You apply.', 'You wait.', 'You get a generic rejection.', 'Or worse, you hear nothing.']}</Lines>

      <p style={prose}>Then you start guessing.</p>
      <Lines style={{ fontWeight: 500 }}>{['Did my resume pass the ATS?', 'Was I qualified?', 'Was my English good enough?', 'Was it my nationality?', 'My accent?', 'My lack of Australian experience?']}</Lines>
      <Lines style={{ color: colors.accentPetrol }}>{['Maybe.', "But you usually don't know.", "And that's the problem."]}</Lines>

      <Cloud items={PAIN_CLOUD} caption="Real messages and emails, names removed." />

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

      <div style={section}>
        <h3 style={h2}>That's exactly what Aussie Grad Careers automates.</h3>
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
                {s.d.map(d => (
                  <span key={d} style={{ display: 'block', fontFamily: T.body, fontSize: 15.5, lineHeight: 1.55, color: colors.textSecondary, marginTop: 3 }}>{d}</span>
                ))}
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
        <h3 style={h2}>The result?</h3>
        <p style={prose}>
          Instead of spending an hour fighting with ChatGPT, rewriting prompts and wondering what to do
          next, you have a repeatable workflow.
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

        <Cloud items={WIN_CLOUD} caption="Messages from people we have worked with, names removed." />
      </div>

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
    </article>
  );
}
