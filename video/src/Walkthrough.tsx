/**
 * The walkthrough engine. One recording in, one edited video out.
 *
 * A chapter file (see diagnosis.tsx) lists clips cut from the recording, and for
 * each clip where the camera should be. Everything is in the recording's own
 * units: seconds of source time, and CSS pixels of the recorded page. The
 * cursor is not in the recording at all. It is drawn here from the event log
 * the recorder wrote, which is why it can be large, smooth and click-rippled.
 */
import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont as loadGeist } from '@remotion/google-fonts/Geist';
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces';

const { fontFamily: SANS } = loadGeist('normal', { weights: ['500', '600'], subsets: ['latin'] });
const { fontFamily: SERIF } = loadFraunces('normal', { weights: ['500'], subsets: ['latin'] });

/** White, blue, gold. The same three the site uses (src/lib/theme/warmTokens.ts). */
export const C = {
  white: '#FFFFFF', alt: '#F5F7FA', navy: '#0F2038', text: '#111827', muted: '#6D7A8C',
  border: '#E6EAF0', blue: '#1257C4', blueSoft: '#EEF3FD', gold: '#C9901A',
};

/** A framing. The camera snaps to it at t (seconds into the clip) and then holds. */
export type Key = { t: number; x: number; y: number; s: number };
export type Rect = { x: number; y: number; w: number; h: number; radius?: number };
/** A shimmering ring round one control, from..to in seconds into the clip. */
export type Highlight = { from: number; to: number; rect: Rect };
export type Clip = {
  /** Source seconds. */
  from: number; to: number;
  /** Framings, in order. The first is where the clip opens; x,y is the point to centre on. */
  cam: Key[];
  highlights?: Highlight[];
  caption?: string;
  /** Drawn in page coordinates, so it zooms with the page. */
  overlay?: (srcT: number, cursor: { x: number; y: number }) => React.ReactNode;
};
export type RecEvent = {
  t: number; type: string; name?: string; ms?: number; x?: number; y?: number;
  from?: { x: number; y: number }; to?: { x: number; y: number }; rect?: Rect;
};
export type Chapter = {
  src: string;
  view: { width: number; height: number };
  events: RecEvent[];
  intro: { line: string; sub: string; seconds: number };
  outro: { line: string; sub: string; seconds: number };
  clips: Clip[];
};

export const FPS = 30;
const XFADE = 5; // frames each clip dissolves in over the one before
const SNAP = 10; // frames the camera takes to reach a new framing

/**
 * Where things sit in the frame. The stage is the rounded window the recording
 * plays in; `caption` is the band its one line of copy sits in.
 */
export type Layout = {
  w: number; h: number;
  stage: { x: number; y: number; w: number; h: number; radius: number };
  caption: { top: number; bottom: number; size: number; width: number; align: 'center' | 'flex-end' };
  /** The opening and closing cards. top/bottom are the band the block is centred in. */
  card: { top: number; bottom: number; width: number; logo: number; line: number; sub: number; button: number };
  /** Draw the pointer as a fingertip, not an arrow. */
  touch: boolean;
};

export const LANDSCAPE: Layout = {
  w: 1920, h: 1080,
  stage: { x: 128, y: 40, w: 1664, h: 936, radius: 22 },
  caption: { top: 976, bottom: 1080, size: 42, width: 1700, align: 'center' },
  card: { top: 0, bottom: 1080, width: 1400, logo: 84, line: 92, sub: 44, button: 40 },
  touch: false,
};

/**
 * 1080x1920 for Reels, TikTok and Shorts. Each app draws its own chrome over
 * the video, and they do not agree on where, so this keeps to the overlap:
 *
 *   top 250     account name, "Following / For you", the search icon
 *   bottom 480  the post caption, audio line and progress bar
 *   right 140   like / comment / share column
 *   left 60     edge padding
 *
 * Nothing sits outside that box but background. The right margin is the tight
 * one, and it is mirrored on the left so the stage stays centred under the
 * copy. The copy goes ABOVE the stage: the bottom of the frame is the one
 * place every app covers.
 */
export const PORTRAIT: Layout = {
  w: 1080, h: 1920,
  stage: { x: 140, y: 470, w: 800, h: 970, radius: 28 },
  caption: { top: 250, bottom: 446, size: 56, width: 800, align: 'flex-end' },
  card: { top: 250, bottom: 1440, width: 800, logo: 84, line: 80, sub: 42, button: 40 },
  touch: true,
};

/** The part of the recorded page the stage shows at zoom 1, in page pixels. */
export const windowOf = (view: { width: number }, l: Layout) =>
  ({ width: view.width, height: (view.width * l.stage.h) / l.stage.w });
/** A real pointer move takes longer than asked: each step is a round trip to the browser. */
const MOVE_STRETCH = 1.2;
/** Seconds the pointer stays on screen after it last did something. */
const IDLE = 1.3;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Fast away, soft landing. What makes a move feel snappy rather than abrupt. */
const snapEase = (x: number) => 1 - Math.pow(1 - x, 4);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sec = (s: number) => Math.round(s * FPS);

export const clipFrames = (c: Clip) => sec(c.to - c.from);
export const chapterFrames = (ch: Chapter) =>
  sec(ch.intro.seconds) + ch.clips.reduce((n, c) => n + clipFrames(c), 0) + sec(ch.outro.seconds);

/**
 * Snap, then hold. The camera never drifts: it sits on a framing until the next
 * one is due, gets there in SNAP frames, and stops. A slow push that later
 * reverses reads as the edit changing its mind.
 */
function camAt(keys: Key[], t: number): Key {
  let cur = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t < b.t) break;
    const k = snapEase(clamp((t - b.t) / (SNAP / FPS), 0, 1));
    cur = { t, x: cur.x + (b.x - cur.x) * k, y: cur.y + (b.y - cur.y) * k, s: cur.s + (b.s - cur.s) * k };
  }
  return cur;
}

function cursorAt(events: RecEvent[], t: number, view: Chapter['view']) {
  const moves = events.filter((e) => e.type === 'move' && e.from && e.to);
  let pos = moves[0]?.from ?? { x: view.width / 2, y: view.height * 0.8 };
  for (const m of moves) {
    if (t < m.t) break;
    const dur = ((m.ms ?? 700) * MOVE_STRETCH) / 1000;
    const k = ease(clamp((t - m.t) / dur, 0, 1));
    pos = { x: m.from!.x + (m.to!.x - m.from!.x) * k, y: m.from!.y + (m.to!.y - m.from!.y) * k };
  }
  const click = events.filter((e) => e.type === 'click' && t >= e.t && t < e.t + 0.6).pop();
  // A parked pointer sits on top of whatever the viewer is trying to read, so it
  // fades once it has been still for a moment and returns just before it moves.
  const busy = [
    ...moves.map((m) => [m.t - 0.3, m.t + ((m.ms ?? 700) * MOVE_STRETCH) / 1000 + IDLE] as const),
    ...events.filter((e) => e.type === 'click').map((e) => [e.t - 0.8, e.t + IDLE] as const),
  ];
  const visible = Math.max(0, ...busy.map(([a, b]) => clamp(Math.min((t - a) / 0.3, (b - t) / 0.4), 0, 1)));
  return { ...pos, visible, click: click ? { x: click.x!, y: click.y!, age: t - click.t } : null };
}

const Cursor: React.FC<{ x: number; y: number; zoom: number; pressed: boolean; opacity: number; touch: boolean }> = ({ x, y, zoom, pressed, opacity, touch }) => {
  // Counter-scale a little so the pointer does not balloon when the camera pushes in.
  const k = (1.5 / Math.sqrt(zoom)) * (pressed ? 0.86 : 1);
  if (touch) {
    // A phone has no arrow. A soft fingertip, centred on the point it presses.
    const d = (26 * (pressed ? 0.8 : 1)) / Math.sqrt(zoom);
    return (
      <div style={{
        position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', opacity,
        background: 'rgba(15,32,56,0.30)', border: `1.5px solid ${C.white}`, boxSizing: 'border-box',
        boxShadow: '0 1px 5px rgba(15,32,56,0.35)',
      }} />
    );
  }
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" style={{
      position: 'absolute', left: x, top: y, transform: `scale(${k})`, transformOrigin: '0 0', opacity,
      filter: 'drop-shadow(0 2px 3px rgba(15,32,56,0.35))', overflow: 'visible',
    }}>
      <path d="M2 1.5 L2 21 L7.4 16.2 L11 24.6 L14.6 23 L11.1 14.8 L18.4 14.6 Z" fill={C.navy} stroke={C.white} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
};

const Ripple: React.FC<{ x: number; y: number; age: number }> = ({ x, y, age }) => {
  const k = clamp(age / 0.45, 0, 1);
  const r = 10 + 34 * (1 - Math.pow(1 - k, 3));
  return (
    <div style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
      border: `3px solid ${C.blue}`, background: 'rgba(18,87,196,0.10)', opacity: 1 - k,
    }} />
  );
};

/**
 * The product's own "look here" signal: the blue and gold sheen the Edit button
 * wears until it is first used (src/components/apply/EditGlowButton.tsx). Same
 * gradient, same pulse, run faster because a video has less time than a page.
 */
const Glow: React.FC<{ h: Highlight; t: number }> = ({ h, t }) => {
  if (t < h.from || t >= h.to) return null;
  const age = t - h.from;
  const inn = clamp(age / 0.13, 0, 1);
  const out = clamp((h.to - t) / 0.1, 0, 1);
  const pad = 5;
  const ring = 3.5;
  const pulse = 0.5 + 0.5 * Math.sin(age * Math.PI * 2 * 1.4);
  const box: React.CSSProperties = {
    position: 'absolute', left: h.rect.x - pad, top: h.rect.y - pad,
    width: h.rect.w + pad * 2, height: h.rect.h + pad * 2,
    borderRadius: (h.rect.radius ?? 12) + pad, boxSizing: 'border-box',
    opacity: Math.min(inn, out), transform: `scale(${1.06 - 0.06 * snapEase(inn)})`,
  };
  return (
    <>
      <div style={{
        ...box,
        boxShadow: `0 0 0 ${2 + 3 * pulse}px rgba(201,144,26,${0.1 + 0.12 * pulse}), 0 0 ${16 + 12 * pulse}px ${2 + 3 * pulse}px rgba(18,87,196,${0.3 + 0.15 * pulse})`,
      }} />
      <div style={{
        ...box, padding: ring,
        background: `linear-gradient(90deg, ${C.blue}, ${C.gold}, #7FB2FF, ${C.blue})`,
        backgroundSize: '200% 100%', backgroundPosition: `${(age / 1.3) * 200}% 50%`,
        // Punch the middle out so only the ring is painted.
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor', maskComposite: 'exclude',
      }} />
    </>
  );
};

const ClipView: React.FC<{ ch: Chapter; clip: Clip; dissolve: boolean; layout: Layout }> = ({ ch, clip, dissolve, layout }) => {
  const STAGE = layout.stage;
  const frame = useCurrentFrame();
  const local = frame / FPS;
  const srcT = clip.from + local;
  const cam = camAt(clip.cam, local);
  const fit = STAGE.w / ch.view.width;
  const z = fit * cam.s;
  // Centre the camera on its point, but never show past the edge of the page.
  const tx = clamp(STAGE.w / 2 - cam.x * z, STAGE.w - ch.view.width * z, 0);
  const ty = clamp(STAGE.h / 2 - cam.y * z, STAGE.h - ch.view.height * z, 0);
  const cur = cursorAt(ch.events, srcT, ch.view);
  const opacity = dissolve ? interpolate(frame, [0, XFADE], [0, 1], { extrapolateRight: 'clamp' }) : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: ch.view.width, height: ch.view.height,
        transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: '0 0',
      }}>
        <OffthreadVideo
          src={staticFile(ch.src)}
          trimBefore={sec(clip.from)}
          muted
          style={{ width: ch.view.width, height: ch.view.height, display: 'block' }}
        />
        {clip.highlights?.map((h, i) => <Glow key={i} h={h} t={local} />)}
        {clip.overlay?.(srcT, cur)}
        {cur.click && <Ripple {...cur.click} />}
        <Cursor x={cur.x} y={cur.y} zoom={cam.s} pressed={!!cur.click && cur.click.age < 0.18} opacity={cur.visible} touch={layout.touch} />
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; frames: number; layout: Layout }> = ({ text, frames, layout: { caption: cap, w, h } }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [2, 8, frames - 6, frames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [2, 8], [10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: (w - cap.width) / 2, width: cap.width, top: cap.top, bottom: h - cap.bottom,
      display: 'flex', alignItems: cap.align, justifyContent: 'center', textAlign: 'center',
      fontFamily: SANS, fontWeight: 600, fontSize: cap.size, lineHeight: 1.16, letterSpacing: -0.4, color: C.navy,
      opacity: o, transform: `translateY(${y}px)`,
    }}><span style={{ textWrap: 'balance' }}>{text}</span></div>
  );
};

const Card: React.FC<{ line: string; sub: string; frames: number; button?: boolean; layout: Layout }> = ({ line, sub, frames, button, layout: { card, h } }) => {
  const frame = useCurrentFrame();
  const inn = (a: number) => interpolate(frame, [a, a + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const out = button ? 1 : interpolate(frame, [frames - 6, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{
      background: C.white, alignItems: 'center', justifyContent: 'center', opacity: out,
      paddingTop: card.top, paddingBottom: h - card.bottom,
    }}>
      <Img src={staticFile('Logo.svg')} style={{ height: card.logo, marginBottom: 44, opacity: inn(0) }} />
      <div style={{
        fontFamily: SERIF, fontWeight: 500, fontSize: card.line, lineHeight: 1.08, letterSpacing: -1.5, color: C.navy,
        textAlign: 'center', textWrap: 'balance', maxWidth: card.width, opacity: inn(2), transform: `translateY(${(1 - inn(2)) * 16}px)`,
      }}>{line}</div>
      <div style={button ? {
        marginTop: 52, padding: '22px 44px', borderRadius: 16, background: C.blue, color: C.white,
        fontFamily: SANS, fontWeight: 600, fontSize: card.button, opacity: inn(9), transform: `scale(${0.96 + 0.04 * inn(9)})`,
      } : {
        marginTop: 36, fontFamily: SANS, fontWeight: 500, fontSize: card.sub, color: C.blue, opacity: inn(9),
        textAlign: 'center', textWrap: 'balance', maxWidth: card.width,
      }}>{sub}</div>
    </AbsoluteFill>
  );
};

export const Walkthrough: React.FC<{ chapter: Chapter; layout?: Layout }> = ({ chapter: ch, layout = LANDSCAPE }) => {
  const STAGE = layout.stage;
  const { durationInFrames } = useVideoConfig();
  const introF = sec(ch.intro.seconds);
  const outroF = sec(ch.outro.seconds);
  let at = introF;
  const placed = ch.clips.map((clip) => { const start = at; at += clipFrames(clip); return { clip, start }; });
  const bodyEnd = at;
  const frame = useCurrentFrame();
  const stageIn = interpolate(frame, [introF - 4, introF + 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  /** A clip that picks up exactly where the last one stopped is the same shot: no dissolve. */
  const continues = (i: number) => i > 0 && placed[i].clip.from === placed[i - 1].clip.to;
  const sameCaption = (i: number) => i > 0 && placed[i].clip.caption === placed[i - 1].clip.caption;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.white} 0%, ${C.alt} 100%)` }}>
      <div style={{
        position: 'absolute', left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h,
        borderRadius: STAGE.radius, overflow: 'hidden', background: C.white, border: `1px solid ${C.border}`,
        boxShadow: '0 30px 80px rgba(15,32,56,0.16), 0 4px 14px rgba(15,32,56,0.08)',
        opacity: stageIn, transform: `scale(${0.97 + 0.03 * stageIn})`,
      }}>
        {placed.map(({ clip, start }, i) => {
          // A clip about to be dissolved over runs a few frames long, so there is something under the dissolve.
          const tail = i < placed.length - 1 && !continues(i + 1) ? XFADE : 0;
          return (
            <Sequence key={i} from={start} durationInFrames={clipFrames(clip) + tail}>
              <ClipView ch={ch} clip={clip} dissolve={i > 0 && !continues(i)} layout={layout} />
            </Sequence>
          );
        })}
      </div>
      {placed.map(({ clip, start }, i) => {
        if (!clip.caption || sameCaption(i)) return null;
        // One caption can span several clips; it stays up across them.
        let frames = clipFrames(clip);
        for (let j = i + 1; j < placed.length && sameCaption(j); j++) frames += clipFrames(placed[j].clip);
        return (
          <Sequence key={`c${i}`} from={start} durationInFrames={frames}>
            <Caption text={clip.caption} frames={frames} layout={layout} />
          </Sequence>
        );
      })}
      <Sequence from={0} durationInFrames={introF}>
        <Card line={ch.intro.line} sub={ch.intro.sub} frames={introF} layout={layout} />
      </Sequence>
      <Sequence from={bodyEnd} durationInFrames={durationInFrames - bodyEnd}>
        <Card line={ch.outro.line} sub={ch.outro.sub} frames={outroF} button layout={layout} />
      </Sequence>
    </AbsoluteFill>
  );
};
