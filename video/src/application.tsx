/**
 * Chapter: one application. Paste a job ad, get the verdict, the tailored
 * resume, the cover letter, and the tracker entry.
 *
 * Times and highlight boxes come from out/application/events.json by name (see
 * kit.ts). The framings are the only hand-chosen numbers.
 */
import rec from '../out/application/events.json';
import { type Chapter, type Clip, type RecEvent } from './Walkthrough';
import { hop, kit, on } from './kit';

const events = rec.events as RecEvent[];
const { at, rect, moveBefore } = kit(events, 'shoot-application.mjs');

// Framings, named for what they hold.
const AD_BOX = { x: 676, y: 400, s: 1.3 };
const VERDICT = { x: 676, y: 350, s: 1.25 };
// Low enough to hold the sticky Save button too, so the save is the same framing, not a move.
const DOC = { x: 706, y: 443, s: 1.3 };
const TRACKED = { x: 706, y: 360, s: 1.3 };

const start = at('start');
const paste = at('paste');
const findMove = moveBefore('find-out');
const findClick = at('find-out', 'click');
const verdict = at('verdict') + 0.3;
const writeFrom = at('write-ready') + 0.15;
const writeClick = at('write', 'click');
const resume = at('resume-done') + 0.5;
const save1Move = moveBefore('save1') - 0.3;
const save1Click = at('save1', 'click');
const cover = at('cover-done') + 0.6;
const save2Move = moveBefore('save2') - 0.3;
const save2Click = at('save2', 'click');
const tracked = at('tracked') + 0.5;

const PASTE = 'Paste any job ad.';
const RESUME = 'A resume written for this exact job.';
const LETTER = 'And a cover letter to match.';

const clips: Clip[] = [
  {
    from: start, to: start + 1.0, caption: PASTE,
    cam: [{ t: 0, ...AD_BOX }],
    highlights: [{ from: 0.3, to: 1.0, rect: rect('ad-box') }],
  },
  {
    // Skip the wait before the paste; land just as the text arrives.
    from: paste - 0.15, to: findClick + 0.35, caption: PASTE,
    cam: [{ t: 0, ...AD_BOX }],
    highlights: [
      { from: 0, to: 0.7, rect: rect('ad-box') },
      { from: findMove - (paste - 0.15), to: findClick - (paste - 0.15) + 0.05, rect: rect('find-out') },
    ],
  },
  {
    from: findClick + 0.6, to: findClick + 1.6, caption: 'It checks the ad against your resume.',
    cam: [{ t: 0, ...AD_BOX }],
  },
  {
    from: verdict, to: at('write-ready') - 0.6, caption: 'Know if it is worth your time.',
    cam: [{ t: 0, ...VERDICT }],
    highlights: [
      { from: 0.5, to: 1.5, rect: rect('verdict-box') },
      ...hop(1.5, 1.0, [rect('why'), rect('against')]),
    ],
  },
  {
    from: writeFrom, to: writeClick + 0.35, caption: 'One click to tailor your resume.',
    cam: [{ t: 0, ...on(rect('write'), 1.4, -40) }],
    highlights: [{ from: 0.2, to: writeClick - writeFrom + 0.05, rect: rect('write') }],
  },
  {
    from: at('writing') + 0.5, to: at('writing') + 1.6, caption: 'One click to tailor your resume.',
    cam: [{ t: 0, x: 640, y: 330, s: 1.15 }],
  },
  {
    from: resume, to: resume + 4.2, caption: RESUME,
    cam: [{ t: 0, ...DOC }],
    highlights: hop(1.6, 0.9, [rect('download-resume'), rect('edit')]),
  },
  {
    from: save1Move, to: save1Click + 0.12, caption: RESUME,
    cam: [{ t: 0, ...DOC }],
    highlights: [{ from: 0.1, to: save1Click - save1Move + 0.05, rect: rect('save1') }],
  },
  {
    from: cover, to: cover + 3.7, caption: LETTER,
    cam: [{ t: 0, ...DOC }],
    highlights: [{ from: 1.6, to: 2.6, rect: rect('download-both') }],
  },
  {
    from: save2Move, to: save2Click + 0.12, caption: LETTER,
    cam: [{ t: 0, ...DOC }],
    highlights: [{ from: 0.1, to: save2Click - save2Move + 0.05, rect: rect('save2') }],
  },
  {
    from: tracked, to: tracked + 4.4, caption: 'Saved to your tracker, ready to send.',
    cam: [{ t: 0, ...TRACKED }],
    highlights: [
      ...hop(0.8, 0.6, [rect('row-0'), rect('row-1')]),
      { from: 2.0, to: 3.6, rect: rect('download-all') },
    ],
  },
];

export const application: Chapter = {
  src: 'application/screen.mp4',
  view: rec.view,
  events,
  intro: { line: 'Still sending the same resume to every job?', sub: 'Tailor every application in minutes.', seconds: 2.2 },
  outro: { line: 'Better applications, in a fraction of the time.', sub: 'aussiegradcareers.com.au', seconds: 3.2 },
  clips,
};
