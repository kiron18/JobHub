/**
 * Chapter: one application, vertical cut. Same story and same copy as
 * ../application.tsx, filmed on the phone layout (shoot-application.mjs --vertical).
 *
 * Times and highlight boxes come from out/application-9x16/events.json by name.
 * Framings are centred on logged rects; the stage shows a 400 x 485 window.
 */
import rec from '../../out/application-9x16/events.json';
import { type Chapter, type Clip, type RecEvent, type Rect } from '../Walkthrough';
import { kit, union } from '../kit';

const events = rec.events as RecEvent[];
const { at, rect, moveBefore } = kit(events, 'shoot-application.mjs --vertical');
const view = rec.view;
const MID = view.width / 2;
/** Full width, centred on a height of the page. The engine stops it at the page edge. */
const row = (y: number, s = 1) => ({ x: MID, y, s });
const mid = (r: Rect) => r.y + r.h / 2;

const adBox = rect('ad-box');
const verdictBox = rect('verdict-box');
const why = rect('why');
const against = rect('against');
const letter = rect('letter-doc');

// Framings, named for what they hold.
const AD_BOX = row(mid(union(adBox, rect('find-out'))));
const VERDICT = row(verdictBox.y + 145); // the job title above the verdict, the first reasons below
// The download button above the page and the Edit button on it.
const DOC = row(union(rect('download-resume'), rect('edit')).y + 225);
// The letter's button row runs off the side of a phone, so this sits just under
// it: pushed in far enough to lose the row, not so far the lines above the page crop.
const LETTER_PAGE = { x: MID, y: letter.y + 60, s: 1.15 };
const SAVE = (name: string) => row(mid(rect(name)) - 150);
const TRACKED = row(mid(union(rect('tracked-head'), rect('download-all'))) + 35);

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
const TAILOR = 'One click to tailor your resume.';
const RESUME = 'A resume written for this exact job.';
const LETTER = 'And a cover letter to match.';

const clips: Clip[] = [
  {
    from: start, to: start + 1.0, caption: PASTE,
    cam: [{ t: 0, ...AD_BOX }],
    highlights: [{ from: 0.3, to: 1.0, rect: adBox }],
  },
  {
    // Skip the wait before the paste; land just as the text arrives.
    from: paste - 0.15, to: findClick + 0.35, caption: PASTE,
    cam: [{ t: 0, ...AD_BOX }],
    highlights: [
      { from: 0, to: 0.7, rect: adBox },
      { from: findMove - (paste - 0.15), to: findClick - (paste - 0.15) + 0.05, rect: rect('find-out') },
    ],
  },
  {
    from: findClick + 0.6, to: findClick + 1.6, caption: 'It checks the ad against your resume.',
    cam: [{ t: 0, ...AD_BOX }],
  },
  {
    // The verdict, then down the page to the reasons for and against.
    from: verdict, to: verdict + 4.2, caption: 'Know if it is worth your time.',
    cam: [{ t: 0, ...VERDICT }, { t: 1.6, ...row(mid(why)) }, { t: 2.8, ...row(mid(against)) }],
    highlights: [
      { from: 0.5, to: 1.6, rect: verdictBox },
      { from: 1.75, to: 2.8, rect: why },
      { from: 2.95, to: 4.0, rect: against },
    ],
  },
  {
    from: writeFrom, to: writeClick + 0.35, caption: TAILOR,
    cam: [{ t: 0, ...row(mid(rect('write')) - 40) }],
    highlights: [{ from: 0.2, to: writeClick - writeFrom + 0.05, rect: rect('write') }],
  },
  {
    from: at('writing') + 0.5, to: at('writing') + 1.6, caption: TAILOR,
    cam: [{ t: 0, ...row(mid(rect('write')) - 40) }],
  },
  {
    from: resume, to: resume + 3.8, caption: RESUME,
    cam: [{ t: 0, ...DOC }],
    highlights: [
      { from: 1.5, to: 2.5, rect: rect('download-resume') },
      { from: 2.5, to: 3.5, rect: rect('edit') },
    ],
  },
  {
    from: save1Move, to: save1Click + 0.12, caption: RESUME,
    cam: [{ t: 0, ...SAVE('save1') }],
    highlights: [{ from: 0.1, to: save1Click - save1Move + 0.05, rect: rect('save1') }],
  },
  {
    from: cover, to: cover + 3.0, caption: LETTER,
    cam: [{ t: 0, ...LETTER_PAGE }],
  },
  {
    from: save2Move, to: save2Click + 0.12, caption: LETTER,
    cam: [{ t: 0, ...SAVE('save2') }],
    highlights: [{ from: 0.1, to: save2Click - save2Move + 0.05, rect: rect('save2') }],
  },
  {
    from: tracked, to: tracked + 4.4, caption: 'Saved to your tracker, ready to send.',
    cam: [{ t: 0, ...TRACKED }],
    highlights: [
      { from: 0.8, to: 1.4, rect: rect('row-0') },
      { from: 1.4, to: 2.0, rect: rect('row-1') },
      { from: 2.0, to: 3.6, rect: rect('download-all') },
    ],
  },
];

export const application: Chapter = {
  src: 'application-9x16/screen.mp4',
  view,
  events,
  intro: { line: 'Still sending the same resume to every job?', sub: 'Tailor every application in minutes.', seconds: 2.2 },
  outro: { line: 'Better applications, in a fraction of the time.', sub: 'aussiegradcareers.com.au', seconds: 3.2 },
  clips,
};
