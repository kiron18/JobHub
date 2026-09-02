import { warm } from '../../lib/theme/warmTokens';
import { proposed as P } from './proposed';
import { Section, Item, Pin, Pins, Spec, Swatch, SwatchRow, Stage, CHROME, Num, Count } from './kit';
import {
  NowPrimary, NowSecondary, NowGhost, NowStrayA, NowStrayB, NowStrayC,
  NextButton, NowInput, NextInput,
} from './specimens';

/* ── 00 · Inventory ─────────────────────────────────────────────────── */

export function SectionInventory() {
  const rows: Array<[string, string, string]> = [
    ['Button shapes', '301', 'distinct combinations of background, colour, radius, padding, size and weight'],
    ['Text colours', '291', 'distinct values, counting token references and hardcoded hex together'],
    ['Backgrounds', '186', 'distinct values'],
    ['Font sizes', '53', 'px numbers and rem strings mixed: 13, 12.5, 11.5, 10.5, 0.9375rem, 0.8125rem'],
    ['Border radii', '36', '2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 28, 99, 999'],
    ['Font weights', '19', 'including 450, 650 and 900, plus ten one-off ternaries'],
    ['Shadows', '15', 'no shared elevation scale'],
    ['Inline style blocks', '3453', 'against 951 className uses across the same files'],
  ];

  return (
    <Section
      n="00"
      title="What is actually on the site today"
      lead={
        <>
          Measured, not estimated. A scan of the 163 client-facing <code style={{ fontFamily: CHROME.mono, fontSize: 12.5 }}>.tsx</code> files
          (admin, coach and internal pages excluded) pulled every inline style block and clustered the values. This is the
          case for the rest of the page.
        </>
      }
    >
      <div style={{ background: CHROME.card, border: `1px solid ${CHROME.line}`, borderRadius: 12, overflow: 'hidden' }}>
        {rows.map(([what, n, note], i) => (
          <div
            key={what}
            style={{
              display: 'grid', gridTemplateColumns: '180px 72px 1fr', gap: 14, alignItems: 'baseline',
              padding: '12px 18px',
              borderTop: i === 0 ? 'none' : `1px solid ${CHROME.hairline}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: CHROME.ink }}>{what}</span>
            <span style={{ fontFamily: CHROME.mono, fontSize: 16, fontWeight: 700, color: '#B3261E' }}>{n}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: CHROME.body }}>{note}</span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: '16px 18px', background: '#FBF1DC',
        border: '1px solid #E8D5A8', borderRadius: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B4A08', marginBottom: 8 }}>Two things worth knowing before you read on</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: '#6B4A08' }}>
          <li>
            The palette is already centralised. <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>src/lib/theme/warmTokens.ts</code> holds
            white, blue and gold and is imported by 80 of 177 files. Colour is roughly 70 percent solved. <strong>Form is not solved at all.</strong>
          </li>
          <li>
            <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>src/index.css</code> still defines the rejected cream and brown palette
            in its <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>@theme</code> block. It contradicts the token file and should be deleted.
          </li>
        </ol>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, lineHeight: 1.65, color: CHROME.body, maxWidth: 760 }}>
        Every item below carries a number. Quote it back at me: <Num n="04.2" /> then what you want. That is the whole review protocol.
      </p>
    </Section>
  );
}

/* ── 01 · Colour ────────────────────────────────────────────────────── */

export function SectionColour() {
  return (
    <Section
      n="01"
      title="Colour"
      lead="The direction is right and is not up for debate here: white page, one blue, gold used sparingly. What is up for debate is how many steps each role needs, and the strays that ignore the token file."
    >
      <Item
        n="01.1"
        title="Surfaces"
        note="White page, white cards, one cool tint, one deep navy. Unchanged in substance."
        verdict={<>The tint moves a shade cooler ({warm.colors.bgAlt} to {P.colors.subtle}) so it reads as a tint and not as a dirty white.</>}
        now={
          <SwatchRow>
            <Swatch hex={warm.colors.bgCanvas} name="Canvas" token="bgCanvas" />
            <Swatch hex={warm.colors.bgSurface} name="Surface" token="bgSurface" />
            <Swatch hex={warm.colors.bgAlt} name="Alt" token="bgAlt" />
            <Swatch hex={warm.colors.bgDeep} name="Deep" token="bgDeep" />
          </SwatchRow>
        }
        next={
          <SwatchRow>
            <Swatch hex={P.colors.canvas} name="Canvas" token="canvas" />
            <Swatch hex={P.colors.surface} name="Surface" token="surface" />
            <Swatch hex={P.colors.subtle} name="Subtle" token="subtle" note="the only tint" />
            <Swatch hex={P.colors.deep} name="Deep" token="deep" note="one block per page" />
          </SwatchRow>
        }
      />

      <Item
        n="01.2"
        title="Ink"
        note="Three steps in the token file. Fourteen more are hardcoded across the pages, mostly Tailwind greys pasted in by hand."
        verdict={<>Keep three steps, cool them very slightly, and sweep the strays. <code style={{ fontFamily: CHROME.mono, fontSize: 12 }}>#9ca3af</code> alone appears 44 times in 9 files.</>}
        now={
          <>
            <SwatchRow>
              <Swatch hex={warm.colors.textPrimary} name="Primary" token="textPrimary" />
              <Swatch hex={warm.colors.textSecondary} name="Secondary" token="textSecondary" />
              <Swatch hex={warm.colors.textMuted} name="Muted" token="textMuted" />
            </SwatchRow>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#B3261E', marginBottom: 8 }}>Strays that ignore the token file</div>
              <SwatchRow>
                <Swatch hex="#9ca3af" name="stray" note="44 uses" />
                <Swatch hex="#6b7280" name="stray" note="36 uses" />
                <Swatch hex="#4b5563" name="stray" note="19 uses" />
                <Swatch hex="#818cf8" name="stray" note="21 uses" />
              </SwatchRow>
            </div>
          </>
        }
        next={
          <>
            <SwatchRow>
              <Swatch hex={P.colors.ink} name="Ink" token="ink" note="headings, values" />
              <Swatch hex={P.colors.body} name="Body" token="body" note="running text" />
              <Swatch hex={P.colors.muted} name="Muted" token="muted" note="labels, meta" />
            </SwatchRow>
            <Spec>{`ink    ${P.colors.ink}   14.7:1 on white
body   ${P.colors.body}   7.9:1 on white
muted  ${P.colors.muted}   4.9:1 on white   (passes AA at 15px)

No fourth step. If something needs to be quieter
than muted, it needs to be smaller or gone.`}</Spec>
          </>
        }
      />

      <Item
        n="01.3"
        title="Accent and semantics"
        note="One blue for anything interactive. Gold only for things that cost the interview. Green and red for outcome only."
        verdict="Add an accentSoft fill so selected and active states stop being invented per screen. Otherwise unchanged."
        now={
          <SwatchRow>
            <Swatch hex={warm.colors.accentPetrol} name="Accent" token="accentPetrol" />
            <Swatch hex={warm.colors.accentPetrolHover} name="Hover" token="accentPetrolHover" />
            <Swatch hex={warm.colors.accentGold} name="Gold" token="accentGold" />
            <Swatch hex={warm.colors.success} name="Success" token="success" />
            <Swatch hex={warm.colors.danger} name="Danger" token="danger" />
          </SwatchRow>
        }
        next={
          <>
            <SwatchRow>
              <Swatch hex={P.colors.accent} name="Accent" token="accent" />
              <Swatch hex={P.colors.accentHover} name="Hover" token="accentHover" />
              <Swatch hex={P.colors.accentPressed} name="Pressed" token="accentPressed" />
              <Swatch hex={P.colors.accentSoft} name="Accent soft" token="accentSoft" note="new" />
            </SwatchRow>
            <div style={{ marginTop: 10 }}>
              <SwatchRow>
                <Swatch hex={P.colors.gold} name="Gold" token="gold" />
                <Swatch hex={P.colors.goldSoft} name="Gold soft" token="goldSoft" />
                <Swatch hex={P.colors.success} name="Success" token="success" />
                <Swatch hex={P.colors.danger} name="Danger" token="danger" />
              </SwatchRow>
            </div>
          </>
        }
      />

      <Item
        n="01.4"
        title="Lines"
        note="Hairline for dividers inside a surface, line for the edge of a surface or control."
        verdict="Unchanged in role, nudged in value so a card edge is visible on white without being a box."
        now={
          <SwatchRow>
            <Swatch hex={warm.colors.borderWhisper} name="Whisper" token="borderWhisper" note="122 uses" />
            <Swatch hex={warm.colors.borderDefined} name="Defined" token="borderDefined" />
          </SwatchRow>
        }
        next={
          <SwatchRow>
            <Swatch hex={P.colors.hairline} name="Hairline" token="hairline" note="inside a surface" />
            <Swatch hex={P.colors.line} name="Line" token="line" note="edge of a surface" />
          </SwatchRow>
        }
      />
    </Section>
  );
}

/* ── 02 · Typography ────────────────────────────────────────────────── */

const NOW_TYPE: Array<[string, number | string, number, string]> = [
  ['Page title', 26, 800, 'invented per page, 24 / 26 / 28 all in use'],
  ['Section heading', 18, 700, ''],
  ['Card heading', 15, 700, ''],
  ['Body', 13, 400, '230 uses, the most common size in the app'],
  ['Body alt', '0.9375rem', 400, 'the same intent, written a different way'],
  ['Small', 12, 400, '176 uses'],
  ['Smaller', 12.5, 600, '67 uses'],
  ['Micro', 11, 700, '196 uses'],
  ['Tiny', 10, 700, '125 uses'],
  ['Tiniest', 9, 800, '59 uses'],
];

export function SectionType() {
  return (
    <Section
      n="02"
      title="Typography"
      lead={
        <>
          The single biggest change on this page. Today the most common font size in JobHub is <strong>13px</strong>, then
          11px, then 12px. Five of the ten most used sizes are 12px or smaller. The product reads as small print, which
          undercuts the price and makes long screens tiring. One family, Geist, is already correct and stays.
        </>
      }
    >
      <Item
        n="02.1"
        title="The scale"
        note="Left is every size in real use, in descending frequency. Right is seven steps, and the base lifts from 13 to 15."
        verdict="53 sizes become 7. Body text 13 becomes 15. Nothing below 11 survives."
        now={
          <>
            <Stage>
              {NOW_TYPE.map(([name, size, weight, note]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, width: 92, flexShrink: 0 }}>
                    {typeof size === 'number' ? `${size}px` : size} / {weight}
                  </span>
                  <span style={{ fontFamily: warm.type.fontBody, fontSize: size, fontWeight: weight, color: warm.colors.textPrimary }}>
                    {name}
                  </span>
                  {note && <span style={{ fontSize: 10.5, color: '#B3261E' }}>{note}</span>}
                </div>
              ))}
            </Stage>
            <Spec>{`53 distinct sizes. px numbers and rem strings
are mixed freely, sometimes in the same file:
13 and '0.8125rem' are the same size written
two ways, and both are in use.`}</Spec>
          </>
        }
        next={
          <>
            <Stage>
              {(Object.entries(P.text) as Array<[string, any]>).map(([key, t]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, width: 92, flexShrink: 0 }}>
                    {t.fontSize}px / {t.fontWeight}
                  </span>
                  <span style={{ fontFamily: P.font, ...t, color: P.colors.ink }}>
                    {key === 'micro' ? 'Micro label' : key === 'body' ? 'Body copy' : key}
                  </span>
                </div>
              ))}
            </Stage>
            <Spec>{`display  34 / 700   page titles, one per screen
h1       26 / 700   section titles
h2       20 / 700   card and panel titles
h3       16 / 600   sub-headings, list titles
body     15 / 400   everything you read
small    13 / 400   meta, captions, help
micro    11 / 600   uppercase labels only`}</Spec>
          </>
        }
      />

      <Item
        n="02.2"
        title="A real paragraph at both sizes"
        note="Same words, same measure. This is the change you will feel most on Welcome, Pricing and the Strategy Hub."
        verdict="Body copy 13px becomes 15px, line height 1.6 becomes 1.55."
        now={
          <Stage>
            <p style={{ margin: 0, fontFamily: warm.type.fontBody, fontSize: 13, lineHeight: 1.6, color: warm.colors.textSecondary, maxWidth: 460 }}>
              Your resume is not being read by a person first. It is being read by a filter that is looking for
              the words in the job ad. Fit Check tells you which of those words you are missing before you apply,
              so you are not guessing why nobody called back.
            </p>
          </Stage>
        }
        next={
          <Stage>
            <p style={{ margin: 0, fontFamily: P.font, ...P.text.body, color: P.colors.body, maxWidth: 460 }}>
              Your resume is not being read by a person first. It is being read by a filter that is looking for
              the words in the job ad. Fit Check tells you which of those words you are missing before you apply,
              so you are not guessing why nobody called back.
            </p>
          </Stage>
        }
      />

      <Item
        n="02.3"
        title="Weight"
        note="Nineteen weights are in use, including 450, 650 and 900, plus ten one-off ternaries like isBold ? 600 : 450."
        verdict="19 weights become 4. Bold is 700, semibold 600, medium 500, regular 400. No 900, no half steps."
        now={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
              {[400, 450, 500, 600, 650, 700, 800, 900].map(w => (
                <div key={w} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: warm.type.fontBody, fontSize: 17, fontWeight: w, color: warm.colors.textPrimary }}>Aa</div>
                  <div style={{ fontFamily: CHROME.mono, fontSize: 10, color: w === 450 || w === 650 || w === 900 ? '#B3261E' : CHROME.faint }}>{w}</div>
                </div>
              ))}
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
              {Object.entries(P.weight).map(([k, w]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: P.font, fontSize: 17, fontWeight: w, color: P.colors.ink }}>Aa</div>
                  <div style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint }}>{w}</div>
                  <div style={{ fontSize: 10, color: CHROME.muted }}>{k}</div>
                </div>
              ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 03 · Space, radius, elevation ──────────────────────────────────── */

export function SectionSpace() {
  const nowRadii = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 28];
  return (
    <Section
      n="03"
      title="Space, radius, elevation"
      lead="Three scales that were never written down, so every screen invented its own. Collapsing these is what stops the site looking like six products."
    >
      <Item
        n="03.1"
        title="Border radius"
        note="36 distinct radii are in use. The top six are 10, 8, 12, 14, 6 and 16, which are visually near identical, so the variety buys nothing and costs consistency."
        verdict="36 radii become 4: 6 for small controls, 10 for buttons and inputs, 14 for cards, pill for tags."
        now={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {nowRadii.map(r => (
                <div key={r} style={{ textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderDefined}`, borderRadius: r }} />
                  <div style={{ fontFamily: CHROME.mono, fontSize: 9.5, color: CHROME.faint, marginTop: 3 }}>{r}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderDefined}`, borderRadius: 999 }} />
                <div style={{ fontFamily: CHROME.mono, fontSize: 9.5, color: CHROME.faint, marginTop: 3 }}>99/999</div>
              </div>
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {Object.entries(P.radius).map(([k, r]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, background: P.colors.subtle, border: `1px solid ${P.colors.line}`, borderRadius: r }} />
                  <div style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, marginTop: 4 }}>{r === 999 ? 'pill' : `${r}px`}</div>
                  <div style={{ fontSize: 10, color: CHROME.muted }}>{k}</div>
                </div>
              ))}
            </div>
            <Spec>{`sm    6    checkboxes, chips, tight controls
md   10    buttons, inputs, selects
lg   14    cards, panels, modals
pill 999   tags and status only`}</Spec>
          </Stage>
        }
      />

      <Item
        n="03.2"
        title="Spacing"
        note="Gaps in use include 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24 and 28. There is no grid, so nothing lines up between screens."
        verdict="A 4pt grid with 7 steps. Odd gaps like 7, 9, 11 and 13 stop existing."
        now={
          <Stage>
            {[2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 18, 22].map(g => (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: CHROME.mono, fontSize: 9.5, color: CHROME.faint, width: 24 }}>{g}</span>
                <div style={{ height: 9, width: g * 6, background: g % 4 === 0 ? warm.colors.borderDefined : '#F0B4B0', borderRadius: 2 }} />
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: '#B3261E', marginTop: 8 }}>Red bars are off any 4pt grid.</div>
          </Stage>
        }
        next={
          <Stage>
            {Object.entries(P.space).map(([k, g]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, width: 34 }}>{k}</span>
                <span style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.muted, width: 26 }}>{g}</span>
                <div style={{ height: 9, width: g * 5, background: P.colors.accent, borderRadius: 2, opacity: 0.75 }} />
              </div>
            ))}
          </Stage>
        }
      />

      <Item
        n="03.3"
        title="Elevation"
        note="15 shadows, most of them one-offs. Several are blue glows built from the accent, which reads as a highlight rather than as height."
        verdict="Three levels only: flat, soft, lifted. Blue glows are removed. Height is never a way to say important."
        now={
          <Stage tint={CHROME.page}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {[
                ['soft', warm.shadow.soft],
                ['lifted', warm.shadow.lifted],
                ['glow 30', `0 4px 16px ${warm.colors.accentPetrol}30`],
                ['glow 40', `0 8px 32px ${warm.colors.accentPetrol}40`],
              ].map(([name, sh]) => (
                <div key={name} style={{ textAlign: 'center' }}>
                  <div style={{ width: 92, height: 56, background: '#fff', borderRadius: 12, boxShadow: sh, border: `1px solid ${warm.colors.borderWhisper}` }} />
                  <div style={{ fontFamily: CHROME.mono, fontSize: 9.5, color: CHROME.faint, marginTop: 5 }}>{name}</div>
                </div>
              ))}
            </div>
          </Stage>
        }
        next={
          <Stage tint={CHROME.page}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {Object.entries(P.shadow).map(([k, sh]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ width: 92, height: 56, background: '#fff', borderRadius: P.radius.lg, boxShadow: sh, border: `1px solid ${P.colors.hairline}` }} />
                  <div style={{ fontFamily: CHROME.mono, fontSize: 10, color: CHROME.faint, marginTop: 5 }}>{k}</div>
                </div>
              ))}
            </div>
            <Spec>{`none    everything on the page by default
soft    controls that sit above the page
lifted  overlays only: modals, popovers,
        toasts, dropdowns`}</Spec>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 04 · Buttons ───────────────────────────────────────────────────── */

export function SectionButtons() {
  return (
    <Section
      n="04"
      title="Buttons"
      lead={
        <>
          <Count n={301} of="distinct button shapes across the client-facing pages." /> Three shared components exist
          (PrimaryButton, SecondaryButton, GhostButton) and they are imported by 5, 1 and 1 files respectively.
          Everything else is hand-built at the call site. This is the single largest source of the inconsistency.
        </>
      }
    >
      <Item
        n="04.1"
        title="Primary, all states pinned"
        note="Nothing here needs hovering. Left is the shared PrimaryButton exactly as it renders today."
        verdict="Height becomes fixed (40px), the blue glow shadow goes, hover darkens the fill instead of lifting the button, and pressed is a real darker step rather than a transform."
        now={
          <Pins>
            <Pin label="default"><NowPrimary state="default" /></Pin>
            <Pin label="hover"><NowPrimary state="hover" /></Pin>
            <Pin label="pressed"><NowPrimary state="pressed" /></Pin>
            <Pin label="focus"><NowPrimary state="focus" /></Pin>
            <Pin label="disabled"><NowPrimary state="disabled" /></Pin>
            <Pin label="loading"><NowPrimary state="loading" /></Pin>
          </Pins>
        }
        next={
          <Pins>
            <Pin label="default"><NextButton state="default" /></Pin>
            <Pin label="hover"><NextButton state="hover" /></Pin>
            <Pin label="pressed"><NextButton state="pressed" /></Pin>
            <Pin label="focus"><NextButton state="focus" /></Pin>
            <Pin label="disabled"><NextButton state="disabled" /></Pin>
            <Pin label="loading"><NextButton state="loading" /></Pin>
          </Pins>
        }
      />

      <Item
        n="04.2"
        title="Secondary, all states pinned"
        now={
          <Pins>
            <Pin label="default"><NowSecondary state="default" /></Pin>
            <Pin label="hover"><NowSecondary state="hover" /></Pin>
            <Pin label="pressed"><NowSecondary state="pressed" /></Pin>
            <Pin label="focus"><NowSecondary state="focus" /></Pin>
            <Pin label="disabled"><NowSecondary state="disabled" /></Pin>
          </Pins>
        }
        verdict="Gains a white fill so it holds its shape on a tinted row, and matches primary's height exactly."
        next={
          <Pins>
            <Pin label="default"><NextButton variant="secondary" label="Not now" /></Pin>
            <Pin label="hover"><NextButton variant="secondary" label="Not now" state="hover" /></Pin>
            <Pin label="pressed"><NextButton variant="secondary" label="Not now" state="pressed" /></Pin>
            <Pin label="focus"><NextButton variant="secondary" label="Not now" state="focus" /></Pin>
            <Pin label="disabled"><NextButton variant="secondary" label="Not now" state="disabled" /></Pin>
          </Pins>
        }
      />

      <Item
        n="04.3"
        title="Ghost, and a danger variant that does not exist yet"
        note="There is no danger button today. Destructive actions are built inline, differently, each time."
        verdict="Add a fourth variant. Four variants, and only four, cover every button in the product."
        now={
          <Pins>
            <Pin label="ghost default"><NowGhost state="default" /></Pin>
            <Pin label="ghost hover"><NowGhost state="hover" /></Pin>
            <Pin label="ghost disabled"><NowGhost state="disabled" /></Pin>
            <Pin label="danger"><span style={{ fontSize: 12, color: '#B3261E', fontStyle: 'italic' }}>does not exist</span></Pin>
          </Pins>
        }
        next={
          <Pins>
            <Pin label="ghost default"><NextButton variant="ghost" label="Skip" /></Pin>
            <Pin label="ghost hover"><NextButton variant="ghost" label="Skip" state="hover" /></Pin>
            <Pin label="ghost disabled"><NextButton variant="ghost" label="Skip" state="disabled" /></Pin>
            <Pin label="danger"><NextButton variant="danger" label="Delete resume" /></Pin>
            <Pin label="danger hover"><NextButton variant="danger" label="Delete resume" state="hover" /></Pin>
          </Pins>
        }
      />

      <Item
        n="04.4"
        title="Size"
        note="Today there is one 'small' flag and everything else is bespoke padding. Heights across the app range from 26px to 54px with no rule."
        verdict="Three sizes with fixed heights: 32 / 40 / 48. A button never sizes itself from its padding again."
        now={
          <Pins>
            <Pin label="small"><NowPrimary small label="Save" /></Pin>
            <Pin label="default"><NowPrimary label="Save" /></Pin>
            <Pin label="inline, from a page"><NowStrayC label="Start the check" /></Pin>
          </Pins>
        }
        next={
          <Pins>
            <Pin label="sm · 32px"><NextButton size="sm" label="Save" /></Pin>
            <Pin label="md · 40px"><NextButton size="md" label="Save" /></Pin>
            <Pin label="lg · 48px"><NextButton size="lg" label="Start the check" /></Pin>
          </Pins>
        }
      />

      <Item
        n="04.5"
        title="A sample of what is actually shipping"
        note="Four real button shapes lifted out of the pages, rendered at their real values. They are all meant to be the same two or three things."
        verdict="All 301 collapse into 04.1 through 04.4. Nothing else gets to be a button."
        now={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <NowStrayA />
              <NowStrayB />
              <NowStrayC />
              <NowPrimary small label="Save" />
            </div>
            <Spec>{`r=6  pad=6px 12px  fs=11  fw=700  transparent
r=8  pad=6px 16px  fs=12  fw=700  #6366f1
r=14 pad=15px 26px fs=16  fw=700  accent
r=10 pad=10px 20px fs=14  fw=600  accent

Four radii, four sizes, four weights,
one of them a colour not in the palette.`}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <NextButton variant="secondary" size="sm" label="Copy" />
              <NextButton variant="primary" size="sm" label="Regenerate" />
              <NextButton variant="primary" size="lg" label="Start the check" />
              <NextButton variant="ghost" size="sm" label="Save" />
            </div>
            <Spec>{`Same four jobs, expressed as
variant + size. Two decisions,
not seven.`}</Spec>
          </Stage>
        }
      />
    </Section>
  );
}

/* ── 05 · Inputs ────────────────────────────────────────────────────── */

export function SectionInputs() {
  return (
    <Section
      n="05"
      title="Inputs and form controls"
      lead="The shared Input is good and is used in 14 files. Its gaps are that it has no label, no hint, and no disabled state, so every form that needs those builds its own."
    >
      <Item
        n="05.1"
        title="Text input, all states pinned"
        verdict="Fixed 40px height to match buttons, a real label and hint slot, and a disabled state. The focus ring loses its double border."
        now={
          <div style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <Pin label="default" wide><NowInput /></Pin>
            <Pin label="focus" wide><NowInput state="focus" /></Pin>
            <Pin label="filled" wide><NowInput state="filled" /></Pin>
            <Pin label="error" wide><NowInput state="error" /></Pin>
            <Pin label="disabled" wide><NowInput state="disabled" /></Pin>
          </div>
        }
        next={
          <div style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <Pin label="default" wide><NextInput label="Email" hint="We send your report here." /></Pin>
            <Pin label="focus" wide><NextInput label="Email" state="focus" hint="We send your report here." /></Pin>
            <Pin label="filled" wide><NextInput label="Email" state="filled" hint="We send your report here." /></Pin>
            <Pin label="error" wide><NextInput label="Email" state="error" /></Pin>
            <Pin label="disabled" wide><NextInput label="Email" state="disabled" hint="Locked while your plan is active." /></Pin>
          </div>
        }
      />

      <Item
        n="05.2"
        title="Textarea, select, checkbox, radio, toggle"
        note="None of these have a shared component. Every one is built inline wherever it is needed, which is why the resume editor, the intake form and the tracker all look like different products."
        verdict="Five new shared controls, matching the input's height, radius and focus ring."
        now={
          <Stage>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#B3261E' }}>
              No shared component exists for any of these. The inventory found them hand-built in
              the onboarding intake, the answer bank, the tracker filters, the document editor and the
              pricing page, with different heights, radii and focus behaviour in each.
            </p>
          </Stage>
        }
        next={
          <div style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
            <Pin label="textarea" wide>
              <textarea
                readOnly
                placeholder="Paste the job description"
                style={{
                  width: '100%', boxSizing: 'border-box', minHeight: 84, padding: '10px 12px',
                  fontFamily: P.font, fontSize: P.text.body.fontSize, color: P.colors.ink,
                  border: `1px solid ${P.colors.line}`, borderRadius: P.radius.md, outline: 'none', resize: 'vertical',
                }}
              />
            </Pin>
            <Pin label="select" wide>
              <select
                style={{
                  width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px',
                  fontFamily: P.font, fontSize: P.text.body.fontSize, color: P.colors.ink,
                  background: P.colors.surface, border: `1px solid ${P.colors.line}`,
                  borderRadius: P.radius.md, outline: 'none',
                }}
              >
                <option>Applied</option><option>Interviewing</option>
              </select>
            </Pin>
            <Pin label="checkbox / radio / toggle" wide>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: P.font, fontSize: 13, color: P.colors.ink }}>
                  <span style={{
                    width: 17, height: 17, borderRadius: P.radius.sm, background: P.colors.accent,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>✓</span>
                  Checked
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: P.font, fontSize: 13, color: P.colors.ink }}>
                  <span style={{
                    width: 17, height: 17, borderRadius: '50%', border: `5px solid ${P.colors.accent}`,
                    background: '#fff', boxSizing: 'border-box',
                  }} />
                  Selected
                </span>
                <span style={{
                  width: 36, height: 21, borderRadius: 999, background: P.colors.accent,
                  position: 'relative', display: 'inline-block',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: 18, width: 15, height: 15, borderRadius: '50%',
                    background: '#fff',
                  }} />
                </span>
              </div>
            </Pin>
          </div>
        }
      />
    </Section>
  );
}
