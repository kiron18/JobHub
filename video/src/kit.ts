/**
 * What every chapter needs to read its recording: look events up by name, so
 * clip times and highlight boxes come from the log instead of being measured
 * by hand, and survive a re-shoot.
 */
import type { Highlight, RecEvent, Rect } from './Walkthrough';

export function kit(events: RecEvent[], shoot: string) {
  const find = (name: string, type?: string) => {
    const e = events.find((x) => x.name === name && (!type || x.type === type));
    if (!e) throw new Error(`events.json has no "${name}". Re-run ${shoot}.`);
    return e;
  };
  return {
    /** When the named mark or click happened, in source seconds. */
    at: (name: string, type?: string) => find(name, type).t,
    rect: (name: string) => find(name, 'rect').rect as Rect,
    /** Every logged rect whose name starts with this, in order. */
    rects: (prefix: string) => events.filter((e) => e.type === 'rect' && e.name?.startsWith(prefix)).map((e) => e.rect as Rect),
    /** When the pointer set off for the click with this name. */
    moveBefore: (name: string) => {
      const c = find(name, 'click').t;
      return [...events].reverse().find((e) => e.type === 'move' && e.t < c)!.t;
    },
    /** The first event of a type after a moment. */
    next: (type: string, after: number) => events.find((e) => e.type === type && e.t > after)!.t,
  };
}

/** One highlight after another, each for `each` seconds. */
export const hop = (start: number, each: number, rects: Rect[]): Highlight[] =>
  rects.map((r, i) => ({ from: start + i * each, to: start + (i + 1) * each, rect: r }));

/** A framing centred on a rect, nudged by dy. */
export const on = (r: Rect, s: number, dy = 0) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 + dy, s });

/** The smallest rect holding all of these. */
export const union = (...rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

/** A framing that fills the stage with a rect, with breathing room, never zooming past `max`. */
export const fit = (r: Rect, view: { width: number; height: number }, pad = 48, max = 1.5) =>
  on(r, Math.max(1, Math.min(max, view.width / (r.w + pad * 2), view.height / (r.h + pad * 2))));
