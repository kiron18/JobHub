/**
 * Chapter: the diagnosis, vertical cut. Same story and same copy as
 * ../diagnosis.tsx, filmed on the phone layout (shoot-diagnosis.mjs --vertical).
 *
 * As there, times and highlight boxes come from events.json by name. Framings
 * are centred on logged rects; the stage shows a 400 x 485 window of the page.
 */
import React from 'react';
import rec from '../../out/diagnosis-9x16/events.json';
import { C, PORTRAIT, windowOf, type Chapter, type Clip, type RecEvent } from '../Walkthrough';
import { hop, kit, union } from '../kit';

const events = rec.events as RecEvent[];
const { at, rect, rects, moveBefore } = kit(events, 'shoot-diagnosis.mjs --vertical');
const view = rec.view;
const WIN = windowOf(view, PORTRAIT);
const MID = view.width / 2;
/** Full width, centred on a height of the page. The engine stops it at the page edge. */
const row = (y: number, s = 1) => ({ x: MID, y, s });

const upload = at('upload');

/** The resume file, carried on the fingertip and dropped into the box. */
const FileChip = (srcT: number, cur: { x: number; y: number }) => {
  const gone = Math.min(1, Math.max(0, (srcT - (upload - 0.12)) / 0.2));
  if (gone >= 1) return null;
  return (
    <div style={{
      position: 'absolute', left: cur.x + 14, top: cur.y + 14, padding: '6px 11px', borderRadius: 9,
      background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 8px 22px rgba(15,32,56,0.18)',
      font: '600 12px Geist, sans-serif', color: C.navy, whiteSpace: 'nowrap',
      opacity: 1 - gone, transform: `scale(${1 - 0.4 * gone})`, transformOrigin: '0 0',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <span style={{ width: 13, height: 17, borderRadius: 3, background: C.blue, display: 'inline-block' }} />
      Maya_Resume.pdf
    </div>
  );
};

const zone = rect('upload-zone');
const overview = rect('card-overview');
const gap = rect('card-gap');
const fix = rect('card-fix');
const fix2 = rect('card-fix-2');
const cta = rect('cta');
// The fourth question is logged below the fold; only the ones on screen get a turn.
const pills = rects('pill-').filter((p) => p.y + p.h < view.height);

// Framings, named for what they hold.
const DOOR = row(zone.y + zone.h / 2 - 85); // the headline above the box as well as the box
const TILES = union(overview, gap, fix);
const CARDS = row(TILES.y + TILES.h / 2 + 10); // the "we've found" line above, the button below
// Opening a tile pulls the stack up the page by this much; hold the open tile at the top.
const PANEL = row(gap.y - 159 + WIN.height / 2);
const FIX_ROW = row(fix2.y + fix2.h / 2);

const doorFrom = at('front-door') + 0.1;
const atZone = at('at-zone') - doorFrom;
const foundFrom = at('diagnosis') + 0.35;
const gapMove = moveBefore('open-gap');
const gapClick = at('open-gap');
const fixFrom = at('card-fix-2-ready') + 0.15;
const fixClick = at('open-fix');
const scrolled = at('fix-scrolled');
const ctaFrom = at('cta-ready') + 0.1;
const press = at('press-fix');
const QUESTIONS_CAPTION = 'Then the exact questions that fix it.';
/** Two questions fit the window at a time, so the camera follows the highlight down. */
const pillCam = pills.map((p, i) => ({ t: i === 0 ? 0 : 0.3 + i * 0.5 - 0.1, ...row(p.y + p.h / 2 + 70) }));

const clips: Clip[] = [
  {
    from: doorFrom, to: upload + 0.3, caption: 'Drop in your resume.', overlay: FileChip,
    cam: [{ t: 0, ...DOOR }],
    highlights: [{ from: atZone - 0.2, to: upload - doorFrom, rect: zone }],
  },
  {
    from: at('loading') + 0.15, to: at('loading') + 1.55, caption: 'It reads every line.',
    cam: [{ t: 0, ...DOOR }],
  },
  {
    // The three findings, pointed at one by one.
    from: foundFrom, to: gapMove, caption: 'It finds where you are losing interviews.',
    cam: [{ t: 0, ...CARDS }],
    highlights: hop(0.75, 0.55, [overview, gap, fix]),
  },
  {
    // Carries straight on from the clip above: same framing, no dissolve.
    from: gapMove, to: gapClick + 3.9, caption: 'Your biggest gap, in plain English.',
    cam: [{ t: 0, ...CARDS }, { t: gapClick - gapMove + 0.12, ...PANEL }],
    highlights: [{ from: 0.1, to: gapClick - gapMove + 0.05, rect: gap }],
  },
  {
    // Ends on the tap: what opens under it is the next clip.
    from: fixFrom, to: fixClick + 0.3, caption: QUESTIONS_CAPTION,
    cam: [{ t: 0, ...FIX_ROW }],
    highlights: [{ from: 0.2, to: fixClick - fixFrom + 0.25, rect: fix2 }],
  },
  {
    // Cut past the scroll itself. Each Fix button gets its turn.
    from: scrolled + 0.1, to: scrolled + 0.1 + 0.3 + pills.length * 0.5 + 0.7, caption: QUESTIONS_CAPTION,
    cam: pillCam,
    highlights: hop(0.3, 0.5, pills),
  },
  {
    from: ctaFrom, to: press + 0.45, caption: 'Answer them once. It rebuilds your resume.',
    cam: [{ t: 0, x: MID, y: cta.y + cta.h / 2 - 60, s: 1.15 }],
    highlights: [{ from: 0.25, to: press - ctaFrom + 0.1, rect: cta }],
  },
];

export const diagnosis: Chapter = {
  src: 'diagnosis-9x16/screen.mp4',
  view,
  events,
  intro: { line: 'Applying everywhere and hearing nothing back?', sub: 'Find out why in about a minute.', seconds: 2.2 },
  outro: { line: 'See what your resume is costing you.', sub: 'aussiegradcareers.com.au', seconds: 3.2 },
  clips,
};
