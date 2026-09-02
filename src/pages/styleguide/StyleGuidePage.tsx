import { useEffect, useState } from 'react';
import { CHROME, Num } from './kit';
import {
  SectionInventory, SectionColour, SectionType, SectionSpace, SectionButtons, SectionInputs,
} from './sectionsA';
import {
  SectionCards, SectionBadges, SectionOverlays, SectionLoading, SectionEmpty,
  SectionTables, SectionNav, SectionToasts, SectionStepper, SectionMotion, SectionIcons,
  SectionFeedback,
} from './sectionsB';

/* ── /styleguide ───────────────────────────────────────────────────────
   A review surface, not a product surface. It renders what JobHub looks
   like today beside what is proposed, with every reviewable item carrying
   a quotable number.

   Nothing on this page is imported by the app. Deleting this folder would
   change nothing about how JobHub renders. Once the proposal is signed off,
   ./proposed.ts gets promoted into src/lib/theme/ and the sweep begins.
*/

const INDEX: Array<[string, string]> = [
  ['00', 'What is on the site today'],
  ['01', 'Colour'],
  ['02', 'Typography'],
  ['03', 'Space, radius, elevation'],
  ['04', 'Buttons'],
  ['05', 'Inputs and form controls'],
  ['06', 'Cards and surfaces'],
  ['07', 'Badges, pills and status'],
  ['08', 'Modals and overlays'],
  ['09', 'Loading and progress'],
  ['10', 'Empty and error states'],
  ['11', 'Tables and lists'],
  ['12', 'Navigation'],
  ['13', 'Toasts'],
  ['14', 'The apply stepper'],
  ['15', 'Motion'],
  ['16', 'Icons'],
  ['17', 'Feedback and celebration'],
];

const KEYFRAMES = `
@keyframes sg-spin { to { transform: rotate(360deg); } }
@keyframes sg-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
`;

export default function StyleGuidePage() {
  const [active, setActive] = useState('00');

  // Highlight whichever section is currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace('s', ''));
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );
    INDEX.forEach(([n]) => {
      const el = document.getElementById(`s${n}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    // The app sets body { overflow: hidden }, so every full-page view owns its own scroll.
    <div style={{ height: '100dvh', overflowY: 'auto', background: CHROME.page, fontFamily: CHROME.sans }}>
      <style>{KEYFRAMES}</style>

      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '0 28px 120px' }}>
        {/* Masthead */}
        <header style={{ padding: '48px 0 32px' }}>
          <div style={{
            fontFamily: CHROME.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: CHROME.faint, marginBottom: 12,
          }}>
            JobHub · design review
          </div>
          <h1 style={{
            margin: '0 0 14px', fontFamily: CHROME.sans, fontSize: 38, lineHeight: 1.1, fontWeight: 700,
            letterSpacing: '-0.025em', color: CHROME.ink, maxWidth: 680,
          }}>
            Every element in the product, before and after
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: CHROME.body, maxWidth: 680 }}>
            Left column is what the product looked like, rebuilt here from the values that were in the codebase.
            Right column is live: those panels render the real shipped components, so what you press here is what
            a client presses. Static states are pinned side by side, and the things that move have a button to play them.
          </p>

          <div style={{
            marginTop: 24, padding: '14px 16px', background: CHROME.card,
            border: `1px solid ${CHROME.line}`, borderRadius: 10, maxWidth: 680,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: CHROME.ink, marginBottom: 6 }}>Start with these three</div>
            <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6, color: CHROME.body }}>
              <Num n="14.1" /> the step rail, stepped through live.{' '}
              <Num n="17.1" /> plays the celebration.{' '}
              <Num n="17.3" /> is the press feel, so hold the mouse down on those.
            </p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: CHROME.body }}>
              To change something, quote its number: <Num n="02.1" /> 15 is too big, go 14. Anything you do not
              mention stands as it is.
            </p>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0 }}>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
            {/* Index */}
            <nav style={{
              position: 'sticky', top: 24, width: 214, flexShrink: 0,
              display: 'none',
            }}
              className="sg-index"
            >
              {INDEX.map(([n, title]) => (
                <a
                  key={n}
                  href={`#s${n}`}
                  style={{
                    display: 'flex', gap: 9, alignItems: 'baseline',
                    padding: '6px 9px', borderRadius: 7, textDecoration: 'none',
                    background: active === n ? CHROME.card : 'transparent',
                    border: `1px solid ${active === n ? CHROME.line : 'transparent'}`,
                    marginBottom: 1,
                  }}
                >
                  <span style={{
                    fontFamily: CHROME.mono, fontSize: 10.5, fontWeight: 700,
                    color: active === n ? CHROME.ink : CHROME.faint, flexShrink: 0,
                  }}>{n}</span>
                  <span style={{
                    fontSize: 12.5, lineHeight: 1.35,
                    color: active === n ? CHROME.ink : CHROME.muted,
                    fontWeight: active === n ? 600 : 400,
                  }}>{title}</span>
                </a>
              ))}
            </nav>

            {/* Sections */}
            <main style={{ flex: 1, minWidth: 0 }}>
              <SectionInventory />
              <SectionColour />
              <SectionType />
              <SectionSpace />
              <SectionButtons />
              <SectionInputs />
              <SectionCards />
              <SectionBadges />
              <SectionOverlays />
              <SectionLoading />
              <SectionEmpty />
              <SectionTables />
              <SectionNav />
              <SectionToasts />
              <SectionStepper />
              <SectionMotion />
              <SectionIcons />
              <SectionFeedback />

              <footer style={{
                marginTop: 8, padding: '20px 22px', background: CHROME.ink,
                borderRadius: 12, color: '#fff',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>What is built, and what is not</div>
                <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.7, color: '#C9D2DE' }}>
                  <strong style={{ color: '#fff' }}>Built and shipping:</strong> the token layer and the type scale in{' '}
                  <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>lib/theme/warmTokens.ts</code>, the motion system in{' '}
                  <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>lib/theme/motion.ts</code>, and the component kit in{' '}
                  <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>components/shared/</code>: Button, IconButton, Card, Input,
                  Textarea, Select, Checkbox, Radio, Toggle, Badge, Skeleton, EmptyState, Modal, StepRail, Celebration.
                  The apply stepper, the tracker celebration, the sidebar and the toasts are wired to them.
                </p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: '#C9D2DE' }}>
                  <strong style={{ color: '#fff' }}>Not yet:</strong> the page-by-page sweep. Screens that still hand-build their
                  own controls keep their old look until they are moved over, highest traffic first. The dead cream palette in{' '}
                  <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>src/index.css</code> is still there and goes with that sweep.
                </p>
              </footer>
            </main>
          </div>
        </div>
      </div>

      {/* The index is only useful when there is room for it beside the content. */}
      <style>{`@media (min-width: 1100px) { .sg-index { display: block !important; } }`}</style>
    </div>
  );
}
