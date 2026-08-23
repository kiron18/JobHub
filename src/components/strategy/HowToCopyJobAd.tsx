/**
 * "How to copy a job ad" — the collapsible tutorial under the paste box.
 *
 * Why this exists. 36% of the tracker once held no employer name, and the ads
 * were not anonymous: Seek prints the advertiser in the page header, above and
 * outside the block people select when they copy a description. So the name was
 * never in the paste. The fix is not a cleverer parser, it is telling people to
 * start the selection higher than they think.
 *
 * It is animated DOM rather than a GIF or a video, for three reasons that all
 * matter here. It weighs a few KB instead of megabytes. Small text on flat
 * colour is exactly what codecs and 256-colour palettes ruin, and this is
 * nothing but small text on flat colour. And a GIF loops from the moment it is
 * mounted, so someone expanding this panel would land halfway through with no
 * idea what they missed; this restarts on open instead.
 *
 * The highlight is a real browser Selection, not a rectangle drawn over the
 * text. That is what makes it hug each line and end ragged where the line ends,
 * and it is why the cursor can sit exactly where a real drag would have reached.
 *
 * The mock is a deliberate imitation of a Seek ad, in Seek's colours, because
 * the whole point is that the viewer recognises the page. All copy is
 * placeholder.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/** Seek's own palette, so the mock reads as the site it is imitating. */
const seek = {
    pink: '#e60278',
    ink: '#1c2b46',
    body: '#1a1a1a',
    muted: '#4a4a4a',
    grey: '#6a6a6a',
    rule: '#e4e4e6',
    cardRule: '#d6d6da',
    badgeBg: '#efe6fb',
    badgeInk: '#5a3ba0',
    green: '#1a7f4b',
    link: '#2b5fb0',
};

/** One full pass: drag down, hold on the finished selection, reset. */
const DRAG_MS = 2600;
const HOLD_MS = 1800;
const RESET_MS = 600;
const CYCLE_MS = DRAG_MS + HOLD_MS + RESET_MS;

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HowToCopyJobAd() {
    const [open, setOpen] = useState(false);
    // Bumping this remounts the stage, which restarts the animation from frame
    // one every time the panel is expanded.
    const [runId, setRunId] = useState(0);

    return (
        <div style={{ marginTop: 14 }}>
            <button
                type="button"
                onClick={() => {
                    setOpen((v) => {
                        if (!v) setRunId((n) => n + 1);
                        return !v;
                    });
                }}
                aria-expanded={open}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
                    background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                    fontSize: 12.5, fontWeight: 600, color: warm.colors.accentPetrol,
                }}
            >
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                What exactly should I copy?
            </button>

            {open && (
                <div
                    style={{
                        marginTop: 12, padding: 16, background: warm.colors.bgAlt,
                        border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 12,
                    }}
                >
                    <p
                        style={{
                            margin: '0 0 14px', fontSize: 13, lineHeight: 1.6,
                            color: warm.colors.textSecondary, maxWidth: '58ch', userSelect: 'none',
                        }}
                    >
                        Start at the <strong style={{ color: warm.colors.textPrimary }}>job title</strong>, not at the
                        description. The employer&#8217;s name sits just under it, so a selection that begins at the
                        first paragraph leaves it behind.
                    </p>

                    <SeekMock key={runId} />

                    <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.6, color: warm.colors.textMuted, userSelect: 'none' }}>
                        Then paste the whole thing above. We read the title, the employer and the description from it.
                    </p>
                </div>
            )}
        </div>
    );
}

/** The imitation ad, with a real selection sweeping over it. */
function SeekMock() {
    const mockRef = useRef<HTMLDivElement | null>(null);
    const regionRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef<HTMLHeadingElement | null>(null);
    const cursorRef = useRef<HTMLDivElement | null>(null);

    const rafRef = useRef<number | null>(null);
    const nodesRef = useRef<Text[]>([]);
    const totalRef = useRef(0);
    const lastIdxRef = useRef(-1);

    /** Drop our selection, but never touch one the viewer made themselves. */
    const clearSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.anchorNode && regionRef.current?.contains(sel.anchorNode)) {
            sel.removeAllRanges();
        }
        if (cursorRef.current) cursorRef.current.style.opacity = '0';
        lastIdxRef.current = -1;
    }, []);

    useEffect(() => {
        const region = regionRef.current;
        const start = startRef.current;
        const mock = mockRef.current;
        const cursor = cursorRef.current;
        if (!region || !start || !mock || !cursor) return;

        // Every text node from the job title to the end of the ad. Selecting
        // across real text nodes is what makes the highlight hug the words.
        const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) =>
                n.nodeValue && n.nodeValue.trim() && !cursor.contains(n)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT,
        });
        const nodes: Text[] = [];
        let total = 0;
        let seen = false;
        while (walker.nextNode()) {
            const n = walker.currentNode as Text;
            if (!seen) {
                if (!start.contains(n)) continue;   // skip the badges above the title
                seen = true;
            }
            nodes.push(n);
            total += n.nodeValue!.length;
        }
        nodesRef.current = nodes;
        totalRef.current = total;
        if (!nodes.length) return;

        const selectTo = (chars: number) => {
            const idx = Math.max(1, Math.min(total, Math.round(chars)));
            if (idx === lastIdxRef.current) return;
            lastIdxRef.current = idx;

            let remaining = idx;
            let endNode = nodes[0];
            let endOffset = 0;
            for (const n of nodes) {
                const len = n.nodeValue!.length;
                if (remaining <= len) { endNode = n; endOffset = remaining; break; }
                remaining -= len;
                endNode = n;
                endOffset = len;
            }

            const range = document.createRange();
            range.setStart(nodes[0], 0);
            range.setEnd(endNode, endOffset);

            const sel = window.getSelection();
            if (!sel) return;
            sel.removeAllRanges();
            sel.addRange(range);

            // Park the cursor where the drag would have reached: the far end of
            // the last highlighted line.
            const rects = range.getClientRects();
            if (rects.length) {
                const last = rects[rects.length - 1];
                const box = mock.getBoundingClientRect();
                cursor.style.left = `${last.right - box.left}px`;
                cursor.style.top = `${last.bottom - box.top}px`;
                cursor.style.opacity = '1';
            }
        };

        if (prefersReducedMotion()) {
            // Finished frame, no motion. The completed selection still teaches it.
            selectTo(total);
            return () => clearSelection();
        }

        const t0 = performance.now();
        const tick = (now: number) => {
            const t = (now - t0) % CYCLE_MS;
            if (t < DRAG_MS) {
                const x = t / DRAG_MS;
                // easeInOutCubic, so the drag starts and settles like a hand
                const eased = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
                selectTo(eased * total);
            } else if (t < DRAG_MS + HOLD_MS) {
                selectTo(total);
            } else {
                clearSelection();
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        const stop = () => {
            if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            clearSelection();
        };

        // If the viewer starts selecting anything themselves, get out of the
        // way permanently. Fighting a person for the selection is maddening,
        // and a demo is never worth that.
        const onSelectStart = (e: Event) => {
            if (!region.contains(e.target as Node)) stop();
        };
        const onHide = () => { if (document.hidden) stop(); };

        document.addEventListener('selectstart', onSelectStart, true);
        document.addEventListener('visibilitychange', onHide);

        return () => {
            document.removeEventListener('selectstart', onSelectStart, true);
            document.removeEventListener('visibilitychange', onHide);
            stop();
        };
    }, [clearSelection]);

    const noSelect = { userSelect: 'none' } as const;

    return (
        <div
            ref={mockRef}
            aria-hidden="true"
            className="agc-seek-mock"
            style={{
                position: 'relative', background: '#fff', border: `1px solid ${seek.cardRule}`,
                borderRadius: 6, padding: '14px 16px 18px', overflow: 'hidden',
                fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif',
            }}
        >
            {/* Chrome above the ad can never be part of the selection. */}
            <div style={{ ...noSelect, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${seek.ink}`,
                            display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: seek.ink,
                        }}
                    >
                        CN
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: seek.ink, lineHeight: 1.05 }}>COMPANY NAME</div>
                        <div style={{ fontSize: 7.5, fontWeight: 600, color: seek.grey, letterSpacing: '.16em', marginTop: 2 }}>
                            COMPANY TAGLINE
                        </div>
                    </div>
                </div>
                <div
                    style={{
                        width: 24, height: 24, border: `1px solid ${seek.rule}`, borderRadius: 6,
                        display: 'grid', placeItems: 'center', gap: 2,
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <span key={i} style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: seek.grey }} />
                    ))}
                </div>
            </div>

            <div ref={regionRef} style={{ position: 'relative', marginTop: 14 }}>
                <div style={{ ...noSelect, display: 'flex', gap: 6, marginBottom: 10 }}>
                    {['Immediate start', 'Strong applicant'].map((b) => (
                        <span
                            key={b}
                            style={{
                                background: seek.badgeBg, color: seek.badgeInk, fontSize: 9,
                                fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                            }}
                        >
                            {b}
                        </span>
                    ))}
                </div>

                {/* the selection begins here */}
                <h4
                    ref={startRef}
                    style={{
                        fontSize: 15, fontWeight: 800, color: seek.ink, margin: '0 0 6px',
                        lineHeight: 1.25, textTransform: 'uppercase',
                    }}
                >
                    Job Title
                </h4>

                <div style={{ fontSize: 11, color: seek.muted, marginBottom: 10 }}>
                    Company Name
                    <span style={{ color: seek.link, textDecoration: 'underline', marginLeft: 7 }}>View all jobs</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                    {['Suburb, City STATE', 'Job Category (Sub Category)', 'Work Type', '$00,000 - $00,000 per year'].map((m) => (
                        <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: seek.muted }}>
                            <span style={{ ...noSelect, width: 9, height: 9, borderRadius: 2, border: `1.4px solid ${seek.grey}`, flex: 'none' }} />
                            {m}
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: 9.5, color: seek.muted, marginBottom: 12 }}>
                    Posted 00d ago&nbsp;&nbsp;&nbsp;High application volume
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <span style={{ background: seek.pink, color: '#fff', fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 5 }}>
                        Quick apply
                    </span>
                    <span
                        style={{
                            background: '#fff', color: seek.ink, fontSize: 11, fontWeight: 700,
                            padding: '7px 20px', borderRadius: 5, border: `1px solid ${seek.cardRule}`,
                        }}
                    >
                        Save
                    </span>
                </div>

                <div style={{ border: `1px solid ${seek.cardRule}`, borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: seek.ink, marginBottom: 4 }}>How you match</div>
                    <div style={{ fontSize: 9, color: seek.muted, marginBottom: 7 }}>0 skills or credentials match your profile</div>
                    <div style={{ fontSize: 9.5, color: seek.muted }}>
                        <span style={{ color: seek.green, fontWeight: 700 }}>&#10003;</span> Skill Name
                    </div>
                </div>

                <div style={{ borderTop: `1px solid ${seek.rule}`, paddingTop: 12 }}>
                    {[
                        'This is the first paragraph of the job description. It explains what the role is and who the employer is looking for.',
                        'This is the second paragraph. It describes the team, who you would report to, and what a typical week looks like.',
                        'This is the final paragraph. It says who the role would suit and what experience to bring.',
                    ].map((p, i) => (
                        <p key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: seek.body, margin: '0 0 9px' }}>{p}</p>
                    ))}

                    <div style={{ fontSize: 12, fontWeight: 800, color: seek.ink, margin: '14px 0 7px' }}>Section Heading</div>
                    <ul style={{ margin: 0, paddingLeft: 15 }}>
                        {[1, 2, 3].map((n) => (
                            <li key={n} style={{ fontSize: 10.5, lineHeight: 1.55, color: seek.body, marginBottom: 4 }}>
                                A question or requirement listed by the employer
                            </li>
                        ))}
                    </ul>
                </div>

                <div
                    ref={cursorRef}
                    style={{
                        position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none',
                        transform: 'translate(-2px, -3px)', willChange: 'left, top',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))',
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke={seek.ink}
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

export default HowToCopyJobAd;
