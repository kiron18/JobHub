/**
 * Chapter: outreach. Say who you want to reach, get the messages for the whole
 * conversation, save them to the tracker.
 *
 * Times and highlight boxes come from out/outreach/events.json by name (see
 * kit.ts). Framings are fitted to the logged rects, so nothing is measured by hand.
 */
import rec from '../out/outreach/events.json';
import { type Chapter, type Clip, type RecEvent } from './Walkthrough';
import { fit, kit, union } from './kit';

const events = rec.events as RecEvent[];
const { at, rect, moveBefore } = kit(events, 'shoot-outreach.mjs');
const view = rec.view;

const fields = [rect('field-name'), rect('field-company'), rect('field-topic')];
const FORM = fit(union(...fields, rect('generate')), view);

const start = at('start') + 0.1;
const typed = at('topic-typed') + 0.3;
const genClick = at('generate', 'click');
const saveFrom = at('save-ready') + 0.2;
const saveClick = at('save', 'click');
/** Seconds into the form clip. */
const f = (name: string) => at(name) - start;

const WRITES = 'One click writes the messages.';
const FOLLOW_UPS = 'And every follow-up after that.';

/** One message card, held on screen with the highlight on it. */
const card = (name: string, seconds: number, caption: string): Clip => {
  const r = rect(`card-${name}`);
  const from = at(`card-${name}-ready`) + 0.2;
  return { from, to: from + seconds, caption, cam: [{ t: 0, ...fit(r, view) }], highlights: [{ from: 0.2, to: Math.min(seconds, 1.6), rect: r }] };
};

// The connection note is written to LinkedIn's 200 characters. A take where the
// draft ran over shows that card in its red warning state, so it is left out.
const noteFits = !events.some((e) => e.name === 'note-over-cap');

const clips: Clip[] = [
  {
    from: start, to: typed, caption: 'Say who you want to reach.',
    cam: [{ t: 0, ...FORM }],
    highlights: [
      { from: f('name-typing') - 0.5, to: f('name-typed') + 0.25, rect: fields[0] },
      { from: f('company-typing') - 0.5, to: f('company-typed') + 0.25, rect: fields[1] },
      { from: f('topic-typing') - 0.5, to: f('topic-typed') + 0.3, rect: fields[2] },
    ],
  },
  {
    // Carries straight on from the typing: same framing, no dissolve.
    from: typed, to: genClick + 0.3, caption: WRITES,
    cam: [{ t: 0, ...FORM }],
    highlights: [{ from: moveBefore('generate') - typed, to: genClick - typed + 0.05, rect: rect('generate') }],
  },
  {
    from: at('generating') + 0.4, to: at('generating') + 1.4, caption: WRITES,
    cam: [{ t: 0, ...FORM }],
  },
  ...(noteFits ? [card('note', 3.0, 'A connection note that sounds like you.')] : []),
  card('first', 3.2, 'The message that asks for the call.'),
  card('after', 1.4, FOLLOW_UPS),
  card('again', 1.4, FOLLOW_UPS),
  card('later', 1.6, FOLLOW_UPS),
  {
    from: saveFrom, to: saveClick + 1.7, caption: 'Save it. Your tracker keeps the whole thread.',
    // Centred on the page, not the button: centring on a button at the right edge crops the text beside it.
    cam: [{ t: 0, x: FORM.x, y: rect('save').y + 190, s: 1.5 }],
    highlights: [{ from: 0.2, to: saveClick - saveFrom + 0.05, rect: rect('save') }],
  },
];

export const outreach: Chapter = {
  src: 'outreach/screen.mp4',
  view,
  events,
  intro: { line: 'The fastest way into a company is a person.', sub: 'Here is how to reach them.', seconds: 2.2 },
  outro: { line: 'Stop waiting on applications. Start conversations.', sub: 'aussiegradcareers.com.au', seconds: 3.2 },
  clips,
};
