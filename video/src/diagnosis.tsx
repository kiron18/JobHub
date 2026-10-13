/**
 * Chapter: the diagnosis. Drop a resume, get told why interviews are not coming.
 *
 * Nothing here is a hand-measured number of seconds into the recording or a
 * hand-measured pixel. Times are offsets from named events in
 * out/diagnosis/events.json and highlight boxes are the rects logged there, so
 * a re-shoot (where the model takes a different time to read the resume) needs
 * no retiming.
 */
import React from 'react';
import rec from '../out/diagnosis/events.json';
import { C, type Chapter, type Clip, type RecEvent } from './Walkthrough';
import { hop, kit } from './kit';

const events = rec.events as RecEvent[];
const { at, rect, rects, moveBefore, next } = kit(events, 'shoot-diagnosis.mjs');

const upload = at('upload');

/** The resume file, carried on the cursor and dropped into the box. */
const FileChip = (srcT: number, cur: { x: number; y: number }) => {
  const gone = Math.min(1, Math.max(0, (srcT - (upload - 0.12)) / 0.2));
  if (gone >= 1) return null;
  return (
    <div style={{
      position: 'absolute', left: cur.x + 22, top: cur.y + 20, padding: '8px 14px', borderRadius: 10,
      background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 8px 22px rgba(15,32,56,0.18)',
      font: '600 14px Geist, sans-serif', color: C.navy, whiteSpace: 'nowrap',
      opacity: 1 - gone, transform: `scale(${1 - 0.4 * gone})`, transformOrigin: '0 0',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ width: 16, height: 20, borderRadius: 3, background: C.blue, display: 'inline-block' }} />
      Maya_Resume.pdf
    </div>
  );
};

// Framings, named for what they hold.
const WIDE = { x: 640, y: 360, s: 1 };
const DOOR = { x: 640, y: 372, s: 1.22 };
const CARDS = { x: 640, y: 322, s: 1.25 };
const PANEL = { x: 640, y: 470, s: 1.4 };
const CARDS_UP = { x: 640, y: 250, s: 1.25 };
const QUESTIONS = { x: 640, y: 430, s: 1.35 };

const doorFrom = at('front-door') + 0.1;
const atZone = at('at-zone') - doorFrom;
const foundFrom = at('diagnosis') + 0.35;
const gapMove = moveBefore('open-gap');
const gapClick = at('open-gap');
const fixMove = moveBefore('open-fix');
const fixClick = at('open-fix');
const scrollStart = next('scroll', fixClick);
const scrolled = at('fix-scrolled');
const ctaFrom = at('cta-ready') + 0.1;
const press = at('press-fix');
const pills = rects('pill-');
const cta = rect('cta');
const QUESTIONS_CAPTION = 'Then the exact questions that fix it.';

const clips: Clip[] = [
  {
    from: doorFrom, to: upload + 0.3, caption: 'Drop in your resume.', overlay: FileChip,
    cam: [{ t: 0, ...WIDE }, { t: atZone - 0.35, ...DOOR }],
    highlights: [{ from: atZone - 0.2, to: upload - doorFrom, rect: rect('upload-zone') }],
  },
  {
    from: at('loading') + 0.15, to: at('loading') + 1.55, caption: 'It reads every line.',
    cam: [{ t: 0, ...DOOR }],
  },
  {
    // The three findings, pointed at one by one.
    from: foundFrom, to: gapMove, caption: 'It finds where you are losing interviews.',
    cam: [{ t: 0, ...CARDS }],
    highlights: hop(0.75, 0.55, [rect('card-overview'), rect('card-gap'), rect('card-fix')]),
  },
  {
    // Carries straight on from the clip above: same framing, no dissolve.
    from: gapMove, to: gapClick + 3.9, caption: 'Your biggest gap, in plain English.',
    cam: [{ t: 0, ...CARDS }, { t: gapClick - gapMove + 0.12, ...PANEL }],
    highlights: [{ from: 0.1, to: gapClick - gapMove + 0.05, rect: rect('card-gap') }],
  },
  {
    from: fixMove - 0.25, to: scrollStart, caption: QUESTIONS_CAPTION,
    cam: [{ t: 0, ...CARDS_UP }, { t: fixClick - fixMove + 0.37, ...QUESTIONS }],
    highlights: [{ from: 0.2, to: fixClick - fixMove + 0.3, rect: rect('card-fix-2') }],
  },
  {
    // Cut past the scroll itself. Each Fix button gets its turn.
    from: scrolled + 0.1, to: scrolled + 0.1 + 0.3 + pills.length * 0.5 + 0.5, caption: QUESTIONS_CAPTION,
    cam: [{ t: 0, ...QUESTIONS }],
    highlights: hop(0.3, 0.5, pills),
  },
  {
    from: ctaFrom, to: press + 0.45, caption: 'Answer them once. It rebuilds your resume.',
    cam: [{ t: 0, x: cta.x + cta.w / 2, y: cta.y + cta.h / 2 - 60, s: 1.5 }],
    highlights: [{ from: 0.25, to: press - ctaFrom + 0.1, rect: cta }],
  },
];

export const diagnosis: Chapter = {
  src: 'diagnosis/screen.mp4',
  view: rec.view,
  events,
  intro: { line: 'Applying everywhere and hearing nothing back?', sub: 'Find out why in about a minute.', seconds: 2.2 },
  outro: { line: 'See what your resume is costing you.', sub: 'aussiegradcareers.com.au', seconds: 3.2 },
  clips,
};
