/**
 * A generated document, shown on a phone the way a document should be shown.
 *
 * The problem this exists to solve: on a phone we used to reflow the resume's
 * markdown to the viewport. That is readable and it is shapeless. The candidate
 * cannot see that it is a two-page A4 document, which on the reveal screen is
 * the entire point - they came here because their resume was the problem, and
 * the answer has to LOOK like a resume.
 *
 * So a phone gets three things instead of one:
 *
 *   the page      The document renders at a fixed 794px - A4 at 96dpi, the same
 *                 geometry as the PDF that comes out the other end (see
 *                 server/src/services/resumePdf.ts) - and the whole thing is
 *                 scaled down to fit the screen. Real proportions, real shape,
 *                 unreadable type. That is fine: this view is for looking, and
 *                 the two below are for reading.
 *   press-hold    A loupe, floating ABOVE the thumb, showing that part of the
 *                 page at readable size. For checking one line without leaving
 *                 the overview.
 *   tap           A full-screen reader, reflowed at 16px. For actually reading
 *                 it end to end. A loupe is a spot-check tool and reading two
 *                 pages through a 260px window would be worse than what this
 *                 replaced.
 *
 * Desktop is untouched: it renders exactly what the caller passed, at full
 * width, with no scaling, no lens and no reader.
 *
 * -- Why the loupe is built this way ------------------------------------------
 *
 * No canvas, no getImageData, no html2canvas. The lens holds a SECOND RENDER of
 * the same React children, scaled with a CSS transform, so the text in it is
 * real vector text and stays crisp at any zoom. Screenshot-based magnifiers
 * blow up a low-res bitmap and stutter or crash on mid-range Android, which is
 * the failure this avoids.
 *
 * Nothing re-renders while a finger is moving. Touch coordinates go into a ref
 * and a requestAnimationFrame loop writes translate3d() straight onto two DOM
 * nodes. React sees no state change between touchstart and touchend, so the
 * cost per frame is one composited transform.
 *
 * The lens DOM is mounted up front and hidden with `visibility`, not unmounted,
 * so the first press does not pay for parsing the markdown mid-gesture.
 *
 * The one deliberate deviation from "make every touch listener passive": the
 * touchmove listener is NOT passive, because while the lens is up it has to
 * call preventDefault to stop the page scrolling out from under the finger. It
 * only ever does that once the lens is already open - a plain scroll over the
 * document is never intercepted.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { useIsMobile, useIsTouchDevice } from '../../hooks/useIsMobile';

/** A4 at 96dpi. The width the PDF renderer lays out to. */
export const A4_WIDTH_PX = 794;

/** A4's 54pt margins, in the same units. Rounded to something that sets well. */
const PAGE_PADDING = '58px 64px';

/** Lens box, in screen pixels. Wide and short: a line of text is wide and short. */
const LENS_W = 260;
const LENS_H = 132;

/**
 * How far above the touch point the lens floats.
 *
 * ~18mm at 96dpi. Under about 15mm the hand covers the thing it is magnifying,
 * which is the whole reason the offset exists.
 */
const LENS_OFFSET = 70;

/** Below this the lens would run off the top of the screen, so it flips under. */
const LENS_FLIP_MARGIN = 8;

/** How long a finger has to stay still before a press becomes a magnify. */
const HOLD_MS = 160;

/** Movement over this many pixels means they are scrolling, not pressing. */
const SLOP_PX = 10;

/** Past this a press is not a tap any more, even if nothing moved. */
const TAP_MAX_MS = 500;

/**
 * Zoom in the lens, as an absolute fraction of true document size rather than a
 * multiple of the fit scale.
 *
 * "2x" sounds right and is not: the page is drawn at about 0.44 on a 390px
 * phone, so 2x of that is 0.88 - still under real size, still squinting. Fixing
 * the lens near 1.0 means its text is the same legible size on a 360px phone
 * and a 430px one.
 */
const LENS_MIN_SCALE = 0.95;
const LENS_MAX_SCALE = 1.2;

const READER_CSS = `
.agc-doc-reader { font-size: 16px; line-height: 1.7; overflow-wrap: anywhere; }
.agc-doc-reader p, .agc-doc-reader li { font-size: 16px; line-height: 1.7; }
.agc-doc-reader h1 { font-size: 24px; }
/* Big enough to be a section marker in both dialects the two callers speak:
   the welcome page sets h2 as an uppercase tracked label, the stepper sets it
   as a plain serif heading. At 12.5 the second one read as a caption. */
.agc-doc-reader h2 { font-size: 14px; }
.agc-doc-reader h3 { font-size: 16.5px; }
`;

export interface DocumentPaperProps {
  /**
   * The rendered document. Rendered up to three times - page, lens, reader - so
   * it must be a pure description, not something with its own mutable state.
   */
  children: React.ReactNode;
  /** Carries the caller's document typography. Applied to all three renders. */
  className?: string;
  /** Applied to the paper in flow mode only. Scaled mode paints its own page. */
  style?: React.CSSProperties;
  /**
   * Document typography, applied to ALL THREE renders.
   *
   * Separate from `style` because the caller's paper styling (background,
   * padding, border) is exactly what scaled mode has to override, while its
   * type sizing is exactly what scaled mode has to keep - a page drawn at half
   * size with phone-sized type in it is not a picture of the real document.
   */
  typography?: React.CSSProperties;
  /**
   * Chrome pinned over the top-right of the paper - a page-count badge, an Edit
   * link. Never scaled and never duplicated into the lens.
   */
  corner?: React.ReactNode;
  /** Named in the reader's header, so it is obvious what was opened. */
  readerTitle?: string;
  /**
   * Force the desktop rendering. Used while editing: a scaled-down textarea is
   * unusable, so editing always happens reflowed.
   */
  flow?: boolean;
}

export function DocumentPaper({
  children, className, style, typography, corner, readerTitle = 'Your document', flow,
}: DocumentPaperProps) {
  const isMobile = useIsMobile();
  const isTouch = useIsTouchDevice();
  const scaled = isMobile && !flow;

  const hostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const lensInnerRef = useRef<HTMLDivElement>(null);

  const [fit, setFit] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [reader, setReader] = useState(false);

  /*
    Two measurements, neither of which announces itself with a render: the host
    width on rotation, and the page height when the document changes under it
    (a save, a regeneration, a late font swap).
  */
  useLayoutEffect(() => {
    if (!scaled) return;
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) return;

    const measure = () => {
      const w = host.clientWidth;
      if (w > 0) setFit(w / A4_WIDTH_PX);
      setNaturalHeight(page.offsetHeight);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    ro.observe(page);
    return () => ro.disconnect();
    // Deliberately not keyed on `children`: that is a fresh element object on
    // every render, so it would tear down and rebuild the observer several
    // times a keystroke. The observer on `page` already reports a content
    // change, which is the thing `children` was standing in for.
  }, [scaled]);

  /* -- The lens ----------------------------------------------------------- */

  const active = useRef(false);
  const point = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const startPoint = useRef({ x: 0, y: 0 });

  const lensScale = Math.min(LENS_MAX_SCALE, Math.max(LENS_MIN_SCALE, fit * 2));

  const draw = useCallback(() => {
    const lens = lensRef.current;
    const inner = lensInnerRef.current;
    const host = hostRef.current;
    if (!lens || !inner || !host) return;

    const { x, y } = point.current;
    const rect = host.getBoundingClientRect();

    // Where the finger is, in the page's own 794px coordinate space.
    let px = (x - rect.left) / fit;
    const py = (y - rect.top) / fit;

    // Horizontally the page has a known width, so the lens can always be kept
    // full of document instead of showing a band of nothing at the margins.
    const halfWindow = LENS_W / (2 * lensScale);
    px = Math.min(A4_WIDTH_PX - halfWindow, Math.max(halfWindow, px));

    // Put that page point in the middle of the lens.
    const a = LENS_W / 2 - px * lensScale;
    const b = LENS_H / 2 - py * lensScale;
    inner.style.transform = `translate3d(${a}px, ${b}px, 0) scale(${lensScale})`;

    // The lens itself floats above the thumb, clamped into the viewport, and
    // flips underneath rather than clipping when there is no room above.
    const left = Math.min(window.innerWidth - LENS_W - 8, Math.max(8, x - LENS_W / 2));
    const above = y - LENS_H - LENS_OFFSET;
    const top = above < LENS_FLIP_MARGIN ? y + LENS_OFFSET : above;
    lens.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, [fit, lensScale]);

  /*
    The frame loop reads the CURRENT draw through a ref rather than closing over
    one.

    `draw` changes identity whenever the fit scale does — a rotation, a resize,
    the first measurement landing. A loop that captured `draw` would keep
    calling whichever version was current when the press started, so a rotation
    mid-press would leave the lens sampling the old geometry. Going through a
    ref also means `start` never has to change identity, which keeps the touch
    listeners bound once instead of being torn down and re-added on every
    measurement.
  */
  const drawRef = useRef(draw);
  useLayoutEffect(() => { drawRef.current = draw; }, [draw]);

  const stop = useCallback(() => {
    if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    if (!active.current) return;
    active.current = false;
    if (lensRef.current) lensRef.current.style.visibility = 'hidden';
  }, []);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    if (lensRef.current) lensRef.current.style.visibility = 'visible';
    // A function declaration, so it can schedule itself without the reference
    // being a stale copy of an earlier render's closure.
    function tick() {
      drawRef.current();
      frame.current = requestAnimationFrame(tick);
    }
    tick();
  }, []);

  useEffect(() => {
    if (!scaled || !isTouch) return;
    const host = hostRef.current;
    if (!host) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      point.current = { x: t.clientX, y: t.clientY };
      startPoint.current = { x: t.clientX, y: t.clientY };
      startedAt.current = Date.now();
      holdTimer.current = window.setTimeout(start, HOLD_MS);
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      point.current = { x: t.clientX, y: t.clientY };

      if (active.current) {
        // The finger is driving the lens, so the page must not scroll away
        // underneath it. This is the only moment this listener intervenes.
        e.preventDefault();
        return;
      }
      const moved = Math.hypot(t.clientX - startPoint.current.x, t.clientY - startPoint.current.y);
      if (moved > SLOP_PX && holdTimer.current !== null) {
        // They are scrolling the page, not asking to magnify it.
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };

    const onEnd = () => {
      const wasActive = active.current;
      const elapsed = Date.now() - startedAt.current;
      const moved = Math.hypot(
        point.current.x - startPoint.current.x,
        point.current.y - startPoint.current.y,
      );
      stop();
      // A short press that never became a magnify and never became a scroll is
      // a tap, and a tap opens the document properly.
      if (!wasActive && elapsed < TAP_MAX_MS && moved <= SLOP_PX) setReader(true);
    };

    host.addEventListener('touchstart', onStart, { passive: true });
    host.addEventListener('touchmove', onMove, { passive: false });
    host.addEventListener('touchend', onEnd);
    host.addEventListener('touchcancel', stop);
    return () => {
      host.removeEventListener('touchstart', onStart);
      host.removeEventListener('touchmove', onMove);
      host.removeEventListener('touchend', onEnd);
      host.removeEventListener('touchcancel', stop);
      stop();
    };
  }, [scaled, isTouch, start, stop]);

  // Nothing behind a full-screen reader should scroll.
  useEffect(() => {
    if (!reader) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReader(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [reader]);

  /* -- Flow mode: desktop, and anywhere editing ---------------------------- */

  if (!scaled) {
    return (
      <div className={className} style={{ position: 'relative', ...style, ...typography }}>
        {corner}
        {children}
      </div>
    );
  }

  /* -- Scaled mode -------------------------------------------------------- */

  /*
    The page itself. The caller's className usually carries a card look of its
    own (a border, a radius, a shadow) and here that would sit INSIDE the frame
    this component draws, giving the page two edges. So the card properties are
    all explicitly flattened and only the typography from the class survives.
  */
  const paper: React.CSSProperties = {
    width: A4_WIDTH_PX,
    boxSizing: 'border-box',
    padding: PAGE_PADDING,
    background: '#fff',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    maxHeight: 'none',
    color: warm.colors.textPrimary,
    ...typography,
  };

  return (
    <>
      <style>{READER_CSS}</style>

      <div
        ref={hostRef}
        style={{
          position: 'relative',
          // The page is a picture until they ask for it, so nothing inside it
          // should be selectable, callout-able or draggable.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          cursor: 'pointer',
        }}
        onClick={() => { if (!isTouch) setReader(true); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The class is for scripts/mobile-sweep.mjs, which would otherwise
            read the 794px page inside this box as a page too wide for the
            phone. It is wider on purpose and it cannot be dragged. */}
        <div className="agc-scaled-page" style={{
          position: 'relative',
          width: '100%',
          height: naturalHeight ? naturalHeight * fit : undefined,
          overflow: 'hidden',
          borderRadius: 12,
          border: `1px solid ${warm.colors.borderDefined}`,
          background: '#fff',
          boxShadow: warm.shadow.lifted,
        }}>
          <div
            ref={pageRef}
            className={className}
            style={{ ...paper, transform: `scale(${fit})`, transformOrigin: 'top left' }}
          >
            {children}
          </div>
        </div>
        {corner}
      </div>

      {/*
        Undiscoverable otherwise. Nobody presses and holds a document on the
        chance that something happens.
      */}
      <p style={{
        margin: '8px 0 0', textAlign: 'center',
        fontSize: 12, lineHeight: 1.5, color: warm.colors.textMuted,
      }}>
        Tap to read it &middot; press and hold to zoom
      </p>

      {/* Mounted from the start and hidden, so the first press costs nothing. */}
      {isTouch && (
        <div
          ref={lensRef}
          aria-hidden
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 120,
            width: LENS_W, height: LENS_H,
            visibility: 'hidden', pointerEvents: 'none',
            overflow: 'hidden', background: '#fff',
            borderRadius: 14,
            border: `1px solid ${warm.colors.borderDefined}`,
            boxShadow: '0 8px 30px rgba(16,24,40,0.28), 0 2px 6px rgba(16,24,40,0.14)',
            willChange: 'transform',
          }}
        >
          <div
            ref={lensInnerRef}
            className={className}
            style={{
              ...paper,
              position: 'absolute', top: 0, left: 0,
              transformOrigin: 'top left', willChange: 'transform',
            }}
          >
            {children}
          </div>
        </div>
      )}

      {reader && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={readerTitle}
          style={{
            position: 'fixed', inset: 0, zIndex: 140,
            background: warm.colors.bgSurface,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <header style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px',
            borderBottom: `1px solid ${warm.colors.borderWhisper}`,
          }}>
            <span style={{
              ...warm.text.h3, color: warm.colors.textPrimary, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {readerTitle}
            </span>
            <button
              type="button"
              onClick={() => setReader(false)}
              aria-label="Close"
              style={{
                flexShrink: 0,
                width: 44, height: 44, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: warm.colors.textSecondary,
              }}
            >
              <X size={20} />
            </button>
          </header>
          <div style={{
            flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            padding: '18px 16px calc(24px + env(safe-area-inset-bottom))',
          }}>
            <div
              className={`${className ?? ''} agc-doc-reader`.trim()}
              style={{
                ...typography,
                background: 'transparent', border: 'none', boxShadow: 'none', padding: 0,
                // The reader's whole job is readable size, so it wins over the
                // document type scale the other two renders share.
                fontSize: undefined, lineHeight: undefined,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DocumentPaper;
