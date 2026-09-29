import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import type { CheatSheet } from './parseCheatSheet';

/* ── SimplePrep ────────────────────────────────────────────────────────
   Interview prep, cut to the four things a person can actually carry into
   the room (Kiron, 2026-09-29: "way too complicated"):

     1. Walking in: one paragraph of mindset.
     2. About me: a short answer they can remember after two reads.
     3. The questions they will probably ask, each with a short answer.
     4. The questions to ask them.

   Built from the same generated sheet as the full cheat sheet, so nothing
   is regenerated and older preps show this too. Everything else the sheet
   carries (proof points, the ad, show-don't-say, cannot-fumble) is simply
   not shown. InterviewPrepView's SIMPLE_INTERVIEW_PREP switch brings the full
   sheet back.
*/

const MINDSET =
  "You have already been picked for this conversation, so walk in as someone deciding whether this role is right for you, not only whether you are right for it. " +
  'Before every answer, take one breath: it reads as someone who thinks before they speak. ' +
  'Answer in three parts, what the situation was, what you did, and how it turned out, and never skip how it turned out. ' +
  'You are a peer who brings something they need, not someone asking for a favour.';

const C = warm.colors;

function Heading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.01em' }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: C.accentGold, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      {children}
    </h2>
  );
}

const card: React.CSSProperties = {
  background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 16, padding: '22px 24px',
};

function Question({ q, say }: { q: string; say: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li style={{ borderTop: `1px solid ${C.borderWhisper}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '14px 0', background: 'none', border: 'none', cursor: say ? 'pointer' : 'default', textAlign: 'left',
          fontFamily: warm.type.fontBody, fontSize: 17, fontWeight: 600, lineHeight: 1.45, color: C.textPrimary,
        }}
      >
        <span>{q}</span>
        {say && <ChevronDown size={18} style={{ flexShrink: 0, marginTop: 3, color: C.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />}
      </button>
      {open && say && (
        <p style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.65, color: C.textSecondary }}>
          “{say}”
        </p>
      )}
    </li>
  );
}

export function SimplePrep({ sheet, company, role }: { sheet: CheatSheet; company?: string | null; role?: string | null }) {
  // The awkward question they are dreading goes in with the rest, not in a
  // section of its own.
  const asked = [
    ...sheet.questions.map(q => ({ q: q.q, say: q.say })),
    ...(sheet.gap ? [{ q: `If they ask about: ${sheet.gap.label}`, say: sheet.gap.say }] : []),
  ].filter(x => x.q);

  const toAsk = [...sheet.yourQuestions, ...sheet.questions.map(q => q.back).filter(Boolean)]
    .filter((q, i, all) => q && all.indexOf(q) === i);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28, fontFamily: warm.type.fontBody }}>
      {(role || company) && (
        <p style={{ margin: 0, fontSize: 15, color: C.textMuted }}>
          {role}{role && company ? ' at ' : ''}{company}
        </p>
      )}

      <section style={card}>
        <Heading n={1}>Walking in</Heading>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: C.textSecondary }}>
          {MINDSET}
          {sheet.oneRule && <> <strong style={{ color: C.textPrimary, fontWeight: 600 }}>For this one: {sheet.oneRule}</strong></>}
        </p>
      </section>

      {sheet.opening?.say && (
        <section style={{ ...card, background: C.accentPetrolSoft, borderColor: 'transparent' }}>
          <Heading n={2}>About me</Heading>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.6, color: C.textPrimary, fontWeight: 500 }}>
            “{sheet.opening.say}”
          </p>
          <p style={{ margin: '12px 0 0', fontSize: 14.5, color: C.textMuted }}>
            Say it out loud twice before the call. Your words, not these, are fine as long as the three parts stay.
          </p>
        </section>
      )}

      {asked.length > 0 && (
        <section style={card}>
          <Heading n={3}>Questions they will probably ask</Heading>
          <p style={{ margin: '0 0 6px', fontSize: 15, color: C.textMuted }}>Tap a question for a short answer.</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {asked.map((x, i) => <Question key={i} q={x.q} say={x.say} />)}
          </ul>
        </section>
      )}

      {toAsk.length > 0 && (
        <section style={card}>
          <Heading n={4}>Questions to ask them</Heading>
          <p style={{ margin: '0 0 10px', fontSize: 15, color: C.textMuted }}>Pick one or two.</p>
          <ul style={{ margin: 0, paddingLeft: 22, listStyle: 'disc outside', display: 'grid', gap: 10 }}>
            {toAsk.map((q, i) => (
              <li key={i} style={{ fontSize: 17, lineHeight: 1.55, color: C.textPrimary }}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
