import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, Copy, Check, X, Star, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { parseReportSections, splitProblemFix } from '../lib/parseReport';

// ── Strategy Hub palette (replaces the previous severity-coded indigo/red/amber/teal) ──
// Calm-ally rule: no red, no orange. Severity coding is removed. Sections use
// neutral slate for informational areas and muted gold for action-worthy ones.
const PETROL = '#2D5A6E';
const GOLD   = '#C5A059';
const SAGE   = '#7DA67D';
const SLATE  = '#9ca3af';
const TEAL   = SAGE; // Legacy alias retained for downstream references (loading spinner, Skool link)
const INDIGO = PETROL; // Legacy alias for the CTA glow + active chip

// ── Section metadata ──────────────────────────────────────────────────────────
// No severity labels. No critical/review distinction. Every section gets the
// same neutral slate treatment; the action-plan section gets a muted gold
// accent to mark it as forward-looking, not because the others are "worse".
const SECTION_META: Record<string, {
  label: string;
  color: string;
  bg: string;
}> = {
  targeting:      { label: 'Targeting',                color: SLATE, bg: 'rgba(160,164,168,0.08)' },
  document_audit: { label: 'Document Audit',           color: SLATE, bg: 'rgba(160,164,168,0.08)' },
  pipeline:       { label: 'Application Pipeline',     color: SLATE, bg: 'rgba(160,164,168,0.08)' },
  honest:         { label: 'Primary Strategic Gap',    color: SLATE, bg: 'rgba(160,164,168,0.08)' },
  fix:            { label: 'Your Next Three Moves',    color: GOLD,  bg: 'rgba(197,160,89,0.08)'  },
};

const SECTION_ORDER    = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix', 'what_jobhub_does'];
const CARDS_TO_RENDER  = ['targeting', 'document_audit', 'pipeline', 'honest', 'fix'];


const SECTION_TEASERS: Record<string, string> = {
  targeting:      'The roles you target and how you frame yourself for them determines everything that follows.',
  document_audit: 'Your resume has 6 seconds. What happens in those 6 seconds decides if a human ever reads your name.',
  pipeline:       '"No response" is a data point, it tells you exactly where in the process you\'re being filtered out.',
  honest:         'The real blocker is almost never what it looks like from the inside. This section names it directly.',
  fix:            'Three actions, ranked by impact. Built from what your documents actually show, not generic advice.',
};

const RESPONSE_INTROS: Record<string, string> = {
  mostly_silence:    'Applications are going in and replies are not coming back yet. The signal is that the next move sits in your targeting, resume, or positioning, before anything in the room.',
  mostly_rejections: 'You are getting noticed, which means the top of the funnel is working. The next move is usually how your experience is framed on the page, not the experience itself.',
  interviews_stall:  'You are getting into the room, which means your documents are doing their job. The next move is how you present your value once you are there.',
  no_offers:         'You are reaching the shortlist. The gap between you and the chosen candidate is narrow and almost always specific and fixable.',
  mix:               'An inconsistent pattern usually means the core positioning is not locked in. Sharpen that first and the rest tends to follow.',
};

// ── Theme — aligned with the Strategy Hub palette (warm charcoal / petrol /
// gold / sage / off-white) so the diagnostic reads as part of the same app,
// not a separate marketing surface. ─────────────────────────────────────────
function makeTheme(isDark: boolean) {
  return isDark ? {
    bg:           '#1A1C1E',
    card:         '#25282B',
    cardBorder:   'rgba(255,255,255,0.06)',
    heading:      '#E0E0E0',
    sub:          '#A0A4A8',
    intro:        '#A0A4A8',
    body:         '#C8CCD0',
    divider:      'rgba(255,255,255,0.06)',
    fixBand:      'rgba(255,255,255,0.025)',
    toggleBg:     'rgba(255,255,255,0.06)',
    toggleColor:  '#A0A4A8',
    stickyBg:     '#1F2225',
    stickyBorder: 'rgba(255,255,255,0.08)',
    modalBg:      '#25282B',
    inputBg:      'rgba(255,255,255,0.04)',
    inputBorder:  'rgba(255,255,255,0.08)',
    inputText:    '#E0E0E0',
    chipBg:       'rgba(255,255,255,0.05)',
    chipBorder:   'rgba(255,255,255,0.10)',
    chipActive:   PETROL,
    referralBg:   'rgba(255,255,255,0.025)',
    referralBorder:'rgba(255,255,255,0.06)',
    blobs:        ['rgba(45,90,110,0.05)', 'rgba(125,166,125,0.04)', 'rgba(197,160,89,0.03)'],
  } : {
    bg:           '#F8FAFC',
    card:         'rgba(255,255,255,0.92)',
    cardBorder:   'rgba(0,0,0,0.08)',
    heading:      '#0F172A',
    sub:          '#64748B',
    intro:        '#64748B',
    body:         '#334155',
    divider:      'rgba(0,0,0,0.07)',
    fixBand:      'rgba(0,0,0,0.025)',
    toggleBg:     'rgba(0,0,0,0.07)',
    toggleColor:  '#64748B',
    stickyBg:     '#ffffff',
    stickyBorder: 'rgba(0,0,0,0.09)',
    modalBg:      '#ffffff',
    inputBg:      'rgba(0,0,0,0.04)',
    inputBorder:  'rgba(0,0,0,0.12)',
    inputText:    '#0F172A',
    chipBg:       'rgba(0,0,0,0.05)',
    chipBorder:   'rgba(0,0,0,0.10)',
    chipActive:   PETROL,
    referralBg:   'rgba(248,250,252,0.95)',
    referralBorder:'rgba(0,0,0,0.07)',
    blobs:        ['rgba(45,90,110,0.07)', 'rgba(125,166,125,0.06)', 'rgba(197,160,89,0.04)'],
  };
}

// ── Inline markdown renderer ───────────────────────────────────────────────────
// Numbers carry the diagnostic's most concrete signal. Bolding them gives a
// scanning eye the data points without forcing the user to read every sentence.
// Matches: "5+ years", "0-2 years", "30%", "$200K", "12 months", "6 weeks".
const NUMBER_PATTERN = /(\d+(?:\.\d+)?(?:[-+](?:\d+(?:\.\d+)?))?[%]?(?:\s*(?:years?|yrs?|months?|weeks?|days?|hrs?|hours?|\+|k|m))?|\$\d+(?:[.,]\d+)?\s*[kKmM]?\+?)/g;

function renderInline(text: string, headingColor?: string): React.ReactNode {
  // First split by bold markers to preserve LLM-emitted bolds.
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {boldParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 700, color: headingColor ?? '#f3f4f6' }}>{part.slice(2, -2)}</strong>;
        }
        // For non-bold segments, auto-bold numeric tokens.
        const numberParts = part.split(NUMBER_PATTERN);
        return (
          <span key={i}>
            {numberParts.map((np, j) =>
              NUMBER_PATTERN.test(np)
                ? <strong key={j} style={{ fontWeight: 700, color: headingColor ?? 'inherit', fontVariantNumeric: 'tabular-nums' }}>{np}</strong>
                : <span key={j}>{np}</span>
            )}
          </span>
        );
      })}
    </>
  );
}

// ── Section preview extraction ───────────────────────────────────────────────
//
// Each section card now shows ALWAYS-VISIBLE: a one-sentence headline + up to
// three operative bullets. Everything else moves behind a "Why this matters"
// accordion. This is the progressive-disclosure pattern from the revamp doc:
// a user should understand the core problem in 30 seconds without scrolling.

interface SectionPreview {
  headline: string;
  bullets: string[];
  depth: string;
}

function extractSectionPreview(markdown: string): SectionPreview {
  const lines = markdown.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() && l.trim() !== '---');
  let headline = '';
  let headlineIdx = -1;

  // Headline: first non-bullet, non-blockquote, non-heading line.
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('-') && !t.startsWith('•') && !t.startsWith('>') && !t.startsWith('#')) {
      headline = t.replace(/[*_`]/g, '');
      headlineIdx = i;
      break;
    }
  }

  // Bullets: first three bullets that follow the headline (or appear before
  // any other paragraph if there's no headline).
  const bullets: string[] = [];
  const consumedIndices = new Set<number>();
  if (headlineIdx >= 0) consumedIndices.add(headlineIdx);

  for (let i = headlineIdx + 1; i < lines.length && bullets.length < 3; i++) {
    const t = lines[i].trim();
    if (t.startsWith('-') || t.startsWith('•')) {
      bullets.push(t.replace(/^[-•]\s*/, ''));
      consumedIndices.add(i);
    } else if (bullets.length > 0) {
      // Stop at the first non-bullet after we started picking bullets.
      break;
    }
  }

  // Depth: everything else, preserving original ordering.
  const depthLines = lines.filter((_, i) => !consumedIndices.has(i));
  const depth = depthLines.join('\n').trim();

  return { headline, bullets, depth };
}

function extractFirstSentence(markdown: string, maxChars = 180): string {
  if (!markdown) return '';
  const clean = markdown.replace(/^#+\s.*$/gm, '').replace(/^[-•]\s.*$/gm, '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  const match = clean.match(/^(.+?[.!?])(\s|$)/);
  let sentence = (match ? match[1] : clean).trim();
  if (sentence.length > maxChars) sentence = sentence.slice(0, maxChars - 1).trimEnd() + '…';
  return sentence;
}

// ── DisconnectCard ──────────────────────────────────────────────────────────
//
// Above-the-fold visual mismatch. Two factual columns side-by-side, one
// gap-insight sentence below. The shape carries the story before the words.
// Calm-ally rule: this is a comparison, not a verdict. Equal weight on both
// columns, no red colour, no severity language. The insight line uses the
// same palette as the sage "next move" accent so it reads as forward motion.

interface PositioningLite {
  raw: string;
  components?: { title?: string; seniority?: string; years?: number; domain?: string; education?: string };
}

interface DisconnectCardProfile {
  targetRole?: string;
  positioningStatement?: PositioningLite | null;
}

const SENIORITY_TARGET_MAP: Record<string, string> = {
  graduate:  'typically 0-2 years',
  junior:    'typically 1-3 years',
  associate: 'typically 1-3 years',
  mid:       'typically 3-5 years',
  senior:    'typically 5-8 years',
  lead:      'typically 7-10 years',
  manager:   'typically 5-10 years',
  principal: 'typically 8-12 years',
  head:      'typically 10+ years',
  director:  'typically 12+ years',
  vp:        'typically 15+ years',
  chief:     'typically 15+ years',
};

function detectTargetSeniority(targetRole?: string): string | null {
  if (!targetRole) return null;
  const lower = targetRole.toLowerCase();
  for (const key of Object.keys(SENIORITY_TARGET_MAP)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

function DisconnectCard({
  profile,
  gapInsight,
  theme,
  isDark,
}: {
  profile: DisconnectCardProfile;
  gapInsight: string;
  theme: ReturnType<typeof makeTheme>;
  isDark: boolean;
}) {
  const targetRole = profile.targetRole?.trim();
  const positioning = profile.positioningStatement;
  const components = positioning?.components ?? {};

  const targetSeniorityKey = detectTargetSeniority(targetRole);
  const targetYearsHint = targetSeniorityKey ? SENIORITY_TARGET_MAP[targetSeniorityKey] : null;

  const currentTitle = components.title?.trim();
  const currentYears = components.years;
  const currentDomain = components.domain?.trim();

  const renderColumn = (
    label: string,
    accentColor: string,
    rows: Array<{ caption: string; value: string }>,
  ) => (
    <div style={{
      flex: 1,
      minWidth: 0,
      padding: '18px 20px',
      background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, opacity: 0.8 }} />
        <p style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: accentColor,
        }}>
          {label}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, i) => (
          <div key={i}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.sub, marginBottom: 2 }}>
              {row.caption}
            </p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.heading, lineHeight: 1.35, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
              {renderInline(row.value, theme.heading)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const targetRows: Array<{ caption: string; value: string }> = [];
  if (targetRole) targetRows.push({ caption: 'Role', value: targetRole });
  if (targetYearsHint) targetRows.push({ caption: 'Experience window', value: targetYearsHint });

  const currentRows: Array<{ caption: string; value: string }> = [];
  if (currentTitle) currentRows.push({ caption: 'Resume reads as', value: currentTitle });
  if (typeof currentYears === 'number' && currentYears > 0) {
    currentRows.push({ caption: 'Experience', value: `${currentYears}${currentYears >= 25 ? '+' : ''} years` });
  }
  if (currentDomain && currentDomain !== 'general industry') {
    currentRows.push({ caption: 'Domain', value: currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1) });
  }

  // If we have nothing useful in either column, don't render — the section is meant to enlighten, not pad.
  if (targetRows.length === 0 && currentRows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      style={{
        background: theme.card,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 20,
        padding: 24,
        marginBottom: 32,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <p style={{
        margin: '0 0 16px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: theme.sub,
        textAlign: 'center',
      }}>
        Where you stand
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {targetRows.length > 0 && renderColumn('Targeting', '#C5A059', targetRows)}
        {currentRows.length > 0 && renderColumn('Your profile reads as', '#A0A4A8', currentRows)}
      </div>

      {gapInsight && (
        <div style={{
          marginTop: 18,
          padding: '14px 18px',
          background: 'rgba(125,166,125,0.06)',
          border: '1px solid rgba(125,166,125,0.25)',
          borderRadius: 12,
        }}>
          <p style={{
            margin: '0 0 6px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#7DA67D',
          }}>
            The gap, in one line
          </p>
          <p style={{ margin: 0, fontSize: 14, color: theme.heading, lineHeight: 1.6, fontWeight: 500 }}>
            {renderInline(gapInsight, theme.heading)}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// Pattern-styled headers — Option 2 / cheap path: no prompt change, just
// recognise the consulting-deck patterns the LLM already emits and decorate
// them in place. Three categories:
//   - REQUIRES  (target signal):  "What X requires", "What X demands", ...
//   - SHOWS     (current state):  "Your resume shows", "What your resume shows"
//   - BRIDGE    (action):         "The bridge", "The fix", "The next move"
const COMPARISON_PATTERNS = {
    REQUIRES: /^(what\s+.+?\s+(requires?|needs?|demands?|expects?|looks\s+for|wants?))\s*:?\s*$/i,
    SHOWS:    /^((what\s+)?your\s+(resume|profile|current\s+resume)(\s+(currently\s+)?shows?)?|your\s+resume\s+currently\s+shows?)\s*:?\s*$/i,
    BRIDGE:   /^(the\s+(bridge|fix|next\s+move|move)|what\s+to\s+do|reframe(d)?\s+as|action\s*\d*)\s*:?\s*$/i,
};

function classifyPatternLine(t: string): 'REQUIRES' | 'SHOWS' | 'BRIDGE' | null {
    if (COMPARISON_PATTERNS.REQUIRES.test(t)) return 'REQUIRES';
    if (COMPARISON_PATTERNS.SHOWS.test(t))    return 'SHOWS';
    if (COMPARISON_PATTERNS.BRIDGE.test(t))   return 'BRIDGE';
    return null;
}

const PATTERN_STYLES: Record<'REQUIRES' | 'SHOWS' | 'BRIDGE', { fg: string; bg: string; border: string; label: string }> = {
    REQUIRES: { fg: '#C5A059', bg: 'rgba(197,160,89,0.10)', border: 'rgba(197,160,89,0.30)', label: 'Target' },
    SHOWS:    { fg: '#A0A4A8', bg: 'rgba(160,164,168,0.08)', border: 'rgba(160,164,168,0.22)', label: 'Current' },
    BRIDGE:   { fg: '#7DA67D', bg: 'rgba(125,166,125,0.10)', border: 'rgba(125,166,125,0.30)', label: 'Next move' },
};

function RenderContent({ text, color, headingColor }: { text: string; color: string; headingColor?: string }) {
  const lines = text.split('\n').filter(l => { const t = l.trim(); return t && t !== '---'; });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {lines.map((line, i) => {
        const t = line.trim();
        const patternKind = classifyPatternLine(t.replace(/[*_`]/g, ''));
        if (patternKind) {
          const style = PATTERN_STYLES[patternKind];
          return (
            <div key={i} style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: style.fg,
              background: style.bg,
              border: `1px solid ${style.border}`,
              borderRadius: 999,
              marginTop: i === 0 ? 0 : 6,
            }}>
              <span style={{ fontSize: 9, opacity: 0.75 }}>{style.label}</span>
              <span style={{ width: 1, height: 11, background: style.border }} />
              <span>{t.replace(/\s*:?\s*$/, '').replace(/[*_`]/g, '')}</span>
            </div>
          );
        }
        if (t.startsWith('> ') || t.startsWith('>')) {
          const quote = t.replace(/^>\s?/, '');
          return (
            <div key={i} style={{
              borderLeft: `3px solid ${color}`,
              paddingLeft: 14,
              margin: '2px 0',
              background: `${color}08`,
              borderRadius: '0 6px 6px 0',
              padding: '8px 12px 8px 14px',
            }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'inherit', fontStyle: 'italic', fontWeight: 450 }}>
                {renderInline(quote, headingColor)}
              </p>
            </div>
          );
        }
        if (t.startsWith('- ') || t.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color, fontWeight: 800, marginTop: 3, flexShrink: 0, fontSize: 14 }}>·</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: 'inherit', fontWeight: 500 }}>
                {renderInline(t.replace(/^[-•]\s/, ''), headingColor)}
              </p>
            </div>
          );
        }
        if (t.startsWith('###') || t.startsWith('##')) {
          return (
            <p key={i} style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85 }}>
              {t.replace(/^#+\s/, '')}
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.8, fontWeight: 450 }}>
            {renderInline(t, headingColor)}
          </p>
        );
      })}
    </div>
  );
}

// ── Social proof widget ────────────────────────────────────────────────────────
const RATING_CHIPS = ['Spot on', 'Eye-opening', 'Needed to hear this', 'Needs more detail'];

function SocialProofWidget({ isDark, theme }: { isDark: boolean; theme: ReturnType<typeof makeTheme> }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleChip(chip: string) {
    setChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
  }

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await api.post('/onboarding/rating', { rating, chips, comment: comment.trim() || undefined });
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      style={{
        background: theme.card,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 20,
        padding: '28px 28px 24px',
        backdropFilter: 'blur(24px)',
      }}
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: theme.heading, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Thanks for the feedback.</p>
          <p style={{ fontSize: 14, color: theme.sub }}>This helps us improve the diagnosis for everyone.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.sub, marginBottom: 8 }}>
            How accurate was your diagnosis?
          </p>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: theme.heading, margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Does this match what you've been experiencing?
          </h3>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <Star
                  size={28}
                  fill={(hovered || rating) >= n ? GOLD : 'none'}
                  color={(hovered || rating) >= n ? GOLD : (isDark ? '#374151' : '#d1d5db')}
                  strokeWidth={1.5}
                  style={{ transition: 'all 0.1s' }}
                />
              </button>
            ))}
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {RATING_CHIPS.map(chip => {
              const active = chips.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleChip(chip)}
                  style={{
                    background: active ? `${INDIGO}15` : theme.chipBg,
                    border: `1px solid ${active ? INDIGO + '50' : theme.chipBorder}`,
                    borderRadius: 99, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    color: active ? INDIGO : theme.sub, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {/* Optional comment */}
          <textarea
            placeholder="Anything else? (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            style={{
              width: '100%', background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
              borderRadius: 10, color: theme.inputText, fontSize: 14,
              padding: '10px 14px', outline: 'none', resize: 'none',
              fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box',
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            style={{
              background: rating ? INDIGO : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
              color: rating ? 'white' : theme.sub,
              border: 'none', borderRadius: 10, padding: '11px 24px',
              fontSize: 14, fontWeight: 700, cursor: rating ? 'pointer' : 'default',
              transition: 'all 0.2s', boxShadow: rating ? `0 4px 14px ${INDIGO}30` : 'none',
            }}
          >
            {submitting ? 'Saving...' : 'Submit feedback'}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface ReportExperienceProps {
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
  createdAt: string | null;
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [isDark, setIsDark] = useState(true);
  const theme = makeTheme(isDark);
  const [processingMs, setProcessingMs] = useState(0);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [showSticky, setShowSticky] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => { const res = await api.get<ReportData>('/onboarding/report'); return res.data; },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => query.state.data?.status === 'PROCESSING' ? 4000 : false,
  });

  const { data: profile } = useQuery<{
    name?: string;
    targetRole?: string;
    responsePattern?: string;
    positioningStatement?: {
      raw: string;
      components?: { title?: string; seniority?: string; years?: number; domain?: string; education?: string };
    } | null;
  }>({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data; },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.status !== 'PROCESSING') { setProcessingMs(0); return; }
    const t = setInterval(() => setProcessingMs(ms => ms + 4000), 4000);
    return () => clearInterval(t);
  }, [data?.status]);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -80px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sections = parseReportSections(data?.reportMarkdown ?? '');
  const status   = data?.status;

  const firstName  = profile?.name?.split(' ')[0] ?? null;
  const targetRole = (profile as any)?.targetRole ?? null;
  const responsePattern = (profile as any)?.responsePattern ?? null;

  const refSlug = (profile?.name ?? '').split(/\s/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'friend';
  const referralLink = `https://aussiegradcareers.com.au?ref=${refSlug}`;
  const shareMsg = `I just found this free tool that analyzed exactly why my applications weren't getting responses. Takes 5 minutes and the report is genuinely useful, ${referralLink}`;


  const cardSections = sections
    .filter(s => CARDS_TO_RENDER.includes(s.key))
    .sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a.key);
      const bi = SECTION_ORDER.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });


  const BLOCKER_PRIORITY = ['document_audit', 'honest', 'targeting', 'pipeline'];
  const BLOCKER_HEADLINES: Record<string, string> = {
    document_audit: 'Next step: sharpen the first six seconds of your resume.',
    honest:         'Next step: align your positioning with the market signal.',
    targeting:      'Next step: tighten which roles you target and how you frame for them.',
    pipeline:       'Next step: convert more applications into conversations.',
  };
  const topKey = BLOCKER_PRIORITY.find(k => sections.some(s => s.key === k));
  const stickyHeadline = topKey ? BLOCKER_HEADLINES[topKey] : 'Your strategic diagnosis is ready.';

  // Overview snapshot was removed in favour of the DisconnectCard.

  // ── Scroll-based focus mode ────────────────────────────────────────────────
  // When the user scrolls through the report, the section closest to the
  // vertical middle of the viewport is "in focus"; peers dim to 0.4 opacity
  // so the page reads section-by-section instead of as a wall of text. If a
  // user expands a section, that section becomes the focus regardless of
  // scroll position. Calm-ally rule: dim, never blur; restore full opacity
  // when no section dominates the viewport (e.g. user is between cards).
  useEffect(() => {
    const refs = sectionRefs.current;
    if (refs.size === 0) return;

    const observer = new IntersectionObserver(
      () => {
        let bestKey: string | null = null;
        let bestRatio = 0;
        const viewportCentre = window.innerHeight / 2;

        refs.forEach((el, key) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          // Skip cards entirely above or below the viewport
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;

          // Score: inverse of distance from viewport centre, weighted by
          // proportion of card visible. Cards near the middle dominate.
          const visibleTop = Math.max(0, rect.top);
          const visibleBottom = Math.min(window.innerHeight, rect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const visibilityRatio = visibleHeight / Math.max(rect.height, 1);
          const cardCentre = (rect.top + rect.bottom) / 2;
          const distance = Math.abs(cardCentre - viewportCentre);
          const proximity = Math.max(0, 1 - distance / window.innerHeight);
          const score = visibilityRatio * 0.5 + proximity * 0.5;

          if (score > bestRatio) {
            bestRatio = score;
            bestKey = key;
          }
        });

        // Only commit a focused section if it's reasonably dominant — otherwise
        // restore full opacity so transitions between sections feel natural.
        setFocusedSection(bestRatio >= 0.55 ? bestKey : null);
      },
      {
        // Multiple thresholds so the callback fires throughout the scroll,
        // not just on enter/exit.
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 0.95],
      },
    );

    refs.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [cardSections.length]);

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes criticalPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: theme.bg, zIndex: 10, transition: 'background 0.3s' }}>

        {/* Ambient blobs */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          {[
            { top: '-15%', left: '-10%', size: 500, color: theme.blobs[0] },
            { top: '50%',  right: '-8%', size: 420, color: theme.blobs[1] },
            { bottom: '-10%', left: '30%', size: 380, color: theme.blobs[2] },
          ].map((b, i) => (
            <div key={i} style={{
              position: 'absolute', width: b.size, height: b.size, borderRadius: '50%',
              background: `radial-gradient(circle at 33% 28%, ${b.color} 0%, transparent 70%)`, ...b,
            }} />
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setIsDark(d => !d)}
          aria-label="Toggle theme"
          className="no-print"
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 20,
            width: 40, height: 40, borderRadius: 99,
            background: theme.toggleBg, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'background 0.2s',
          }}
        >
          {isDark ? <Sun size={16} color={theme.toggleColor} /> : <Moon size={16} color={theme.toggleColor} />}
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '72px 24px 160px' }}>

          {/* ── Personalized header, hidden while report is still generating ── */}
          {!(status === 'PROCESSING' && sections.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 48, textAlign: 'center' }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.sub, marginBottom: 16 }}>
              Your diagnosis
            </p>
            {firstName && (
              <p style={{ fontSize: 'clamp(28px, 5.5vw, 42px)', fontWeight: 900, color: theme.heading, margin: '0 0 6px', lineHeight: 1.12, letterSpacing: '-0.03em' }}>
                Hey {firstName},
              </p>
            )}
            <h1 style={{ fontSize: 'clamp(28px, 5.5vw, 42px)', fontWeight: 900, color: theme.heading, margin: '0 0 20px', lineHeight: 1.12, letterSpacing: '-0.03em' }}>
              {targetRole
                ? <>your{' '}
                    <span style={{ color: GOLD, display: 'inline-block' }}>{targetRole}</span>
                    {' '}strategic diagnosis.
                  </>
                : <>your strategic diagnosis.</>
              }
            </h1>
            <p style={{ fontSize: 16, color: theme.sub, lineHeight: 1.6, margin: '0 0 16px', maxWidth: 520, marginInline: 'auto' }}>
              We analysed your application profile. Here is the gap between your current resume and the roles you are targeting, and the specific moves that close it.
            </p>
            {responsePattern && RESPONSE_INTROS[responsePattern] && (
              <div style={{
                display: 'inline-block',
                margin: '12px auto 0',
                padding: '10px 20px',
                borderRadius: 99,
                background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)'}`,
              }}>
                <p style={{ fontSize: 14, color: isDark ? '#c7d2fe' : '#4338ca', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                  {RESPONSE_INTROS[responsePattern]}
                </p>
              </div>
            )}
          </motion.div>
          )}

          {/* ── Disconnect Card — leads with the visual mismatch ── */}
          {cardSections.length > 0 && profile && (profile.targetRole || profile.positioningStatement?.raw) && (
            <DisconnectCard
              profile={profile}
              gapInsight={extractFirstSentence(
                (sections.find(s => s.key === 'honest')?.content ?? sections.find(s => s.key === 'targeting')?.content ?? ''),
                190
              ) || stickyHeadline}
              theme={theme}
              isDark={isDark}
            />
          )}

          {/* ── Loading / processing — minimal placeholder. The rich shuffling-message
              loading experience lives in ProcessingScreen (shown during onboarding).
              If a user lands here while the report is still generating, give them a
              calm one-line spinner rather than a competing loading UI. ── */}
          {(isLoading || status === 'PROCESSING') && sections.length === 0 && processingMs < 60000 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderTopColor: TEAL, animation: 'spin 0.9s linear infinite',
              }} />
              <p style={{ margin: 0, fontSize: 14, color: theme.sub, lineHeight: 1.5 }}>
                Finalising your report. This usually takes about a minute.
              </p>
            </div>
          )}

          {/* ── Stuck in processing ── */}
          {status === 'PROCESSING' && sections.length === 0 && processingMs >= 60000 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: theme.sub, fontSize: 15, marginBottom: 8 }}>This is taking longer than expected.</p>
              <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Regenerating is safe and only takes a minute.</p>
              <button
                onClick={async () => { await api.post('/onboarding/retry'); setProcessingMs(0); refetch(); }}
                style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
              >
                Regenerate report
              </button>
            </div>
          )}

          {/* ── API error ── */}
          {(isError || (!isLoading && !data)) && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#f87171', fontSize: 15, marginBottom: 8 }}>Couldn't load your report.</p>
              <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Your intake answers are saved, try regenerating.</p>
              <button
                onClick={async () => { await api.post('/onboarding/retry'); refetch(); }}
                style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
              >
                Generate report
              </button>
            </div>
          )}

          {/* ── FAILED / unparseable ── */}
          {!isError && data && (status === 'FAILED' || (status === 'COMPLETE' && sections.length === 0)) && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#f87171', fontSize: 15, marginBottom: 8 }}>
                {status === 'FAILED' ? 'Report generation failed.' : 'Your report couldn\'t be parsed.'}
              </p>
              <p style={{ color: theme.sub, fontSize: 13, marginBottom: 24 }}>Please try again, it only takes a minute.</p>
              <button
                onClick={async () => { await api.post('/onboarding/retry'); refetch(); }}
                style={{ background: '#FCD34D', color: '#111827', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
              >
                Regenerate report
              </button>
            </div>
          )}

          {/* Overview snapshot removed — the DisconnectCard above carries the
              30-second comprehension. Section cards below carry the depth. */}

          {/* ── Section cards (progressive disclosure) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cardSections.map((section, idx) => {
              const meta = SECTION_META[section.key];
              if (!meta) return null;
              const { problem, fix } = splitProblemFix(section.content);
              const sectionNum = String(idx + 1).padStart(2, '0');
              const isOpen = openSection === section.key;
              const teaser = SECTION_TEASERS[section.key] ?? '';

              // Progressive disclosure: extract the always-visible preview
              // (headline + 3 operative bullets) from the problem half. The
              // remaining text + the entire fix zone live behind the
              // "Why this matters" accordion.
              const preview = extractSectionPreview(problem);
              const depthContent = [preview.depth, fix].filter(s => s && s.split('\n').some(l => { const t = l.trim(); return t && t !== '---'; })).join('\n\n---\n\n');
              const hasDepth = depthContent.trim().length > 0;

              // Active section: an explicit expand wins over scroll-based
              // focus. Peers dim to 0.4 so the reading eye lands on the
              // active one without the rest blurring out of usefulness.
              const activeKey = openSection ?? focusedSection;
              const isDimmed = activeKey !== null && activeKey !== section.key;

              return (
                <div
                  key={section.key}
                  id={`section-${section.key}`}
                  ref={(el) => { sectionRefs.current.set(section.key, el); }}
                >
                  <motion.div
                    className="print-card"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                    animate={{ opacity: isDimmed ? 0.4 : 1 }}
                    style={{
                      background: theme.card,
                      borderRadius: 18,
                      border: `1px solid ${isOpen ? `${meta.color}30` : theme.cardBorder}`,
                      borderLeft: `4px solid ${meta.color}`,
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      overflow: 'hidden',
                      boxShadow: isOpen
                        ? `0 4px 24px ${meta.color}12`
                        : '0 2px 8px rgba(0,0,0,0.05)',
                      transition: 'opacity 0.25s, border-color 0.25s, box-shadow 0.25s',
                    }}
                  >
                    {/* Always-visible card body — section label + headline + bullets */}
                    <div style={{ padding: '20px 22px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 900, color: meta.color, opacity: 0.5,
                          letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0, minWidth: 18,
                        }}>
                          {sectionNum}
                        </span>
                        <p style={{
                          margin: 0, flex: 1, fontSize: 11, fontWeight: 800,
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: theme.sub,
                        }}>
                          {meta.label}
                        </p>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0, opacity: 0.7,
                        }} />
                      </div>

                      {/* Headline — always the operative insight, one sentence */}
                      {preview.headline && (
                        <p style={{
                          margin: '0 0 10px',
                          fontSize: 16,
                          fontWeight: 700,
                          color: theme.heading,
                          letterSpacing: '-0.015em',
                          lineHeight: 1.45,
                        }}>
                          {renderInline(preview.headline, theme.heading)}
                        </p>
                      )}

                      {/* Up to three operative bullets */}
                      {preview.bullets.length > 0 && (
                        <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {preview.bullets.map((b, bi) => (
                            <li key={bi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ color: meta.color, marginTop: 5, flexShrink: 0, lineHeight: 0 }}>·</span>
                              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: theme.body, fontWeight: 500 }}>
                                {renderInline(b, theme.heading)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Fallback teaser if extraction produced nothing useful */}
                      {!preview.headline && !preview.bullets.length && teaser && (
                        <p style={{ margin: 0, fontSize: 14, color: theme.body, lineHeight: 1.65 }}>
                          {teaser}.
                        </p>
                      )}
                    </div>

                    {/* Why this matters — accordion toggle */}
                    {hasDepth && (
                      <button
                        onClick={() => setOpenSection(isOpen ? null : section.key)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 22px',
                          background: 'none',
                          borderTop: `1px solid ${theme.divider}`,
                          borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                          cursor: 'pointer', textAlign: 'left',
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                          color: theme.sub,
                        }}
                      >
                        <span>{isOpen ? 'Hide the detail' : 'Why this matters'}</span>
                        <motion.span
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                          style={{ color: theme.sub, flexShrink: 0, display: 'flex' }}
                        >
                          <ChevronDown size={14} />
                        </motion.span>
                      </button>
                    )}

                    {/* Expandable depth */}
                    <AnimatePresence initial={false}>
                      {isOpen && hasDepth && (
                        <motion.div
                          key="body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ padding: '18px 22px 22px', color: theme.body }}>
                            <RenderContent text={depthContent} color={meta.color} headingColor={theme.heading} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Feedback widget moved to footer to stop it interrupting
                      the read. Users who got value give feedback at the end,
                      those who didn't aren't pushed for a rating mid-flow. */}
                </div>
              );
            })}
          </div>

          {/* ── CTA section ── */}
          {sections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              style={{ marginTop: 56 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e80' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#22c55e' }}>
                    Diagnosis complete
                  </span>
                </div>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 900, color: theme.heading, margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.025em' }}>
                  You have the experience.<br />Now let's build the narrative.
                </h2>
                <p style={{ fontSize: 15, color: theme.sub, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 0' }}>
                  {firstName ? `${firstName}, your` : 'Your'} diagnosis points to the exact framing changes that will close the gap. The platform turns it into a tailored resume, cover letter, and selection-criteria responses, ready to send.
                </p>
              </div>

              {/* Primary CTA — calm petrol, no FOMO band */}
              <div ref={ctaRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <motion.button
                  onClick={onDone}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    width: '100%', background: PETROL,
                    color: '#E0E0E0', borderRadius: 14, padding: '16px 24px',
                    fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    boxShadow: `0 6px 24px ${PETROL}40`,
                  }}
                >
                  Turn this diagnosis into an interview-ready resume →
                </motion.button>
                <p style={{ margin: 0, fontSize: 12, color: theme.sub, textAlign: 'center' }}>
                  First five tailored applications free. No card needed.
                </p>
                <div style={{ textAlign: 'center' }}>
                  <a
                    href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: SAGE, textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 600 }}
                  >
                    Or join the free community on Skool, frameworks, templates and weekly guidance →
                  </a>
                </div>
              </div>

              {/* Referral section */}
              <div style={{
                background: theme.referralBg,
                border: `1px solid ${theme.referralBorder}`,
                borderRadius: 20, padding: '22px 24px', marginBottom: 20,
              }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#374151' : '#9ca3af', marginBottom: 6 }}>
                  Know someone in the same boat?
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: theme.heading, margin: '0 0 5px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Share this, they get a free diagnosis.
                </p>
                <p style={{ fontSize: 13, color: theme.sub, lineHeight: 1.6, margin: '0 0 14px' }}>
                  Every international grad you refer gets clarity on the specific moves that will sharpen their applications.
                </p>
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                  borderRadius: 10, padding: '11px 14px', marginBottom: 12,
                  fontSize: 13, color: theme.sub, lineHeight: 1.7, fontStyle: 'italic',
                }}>
                  "I just found this free tool that analyzed exactly why my applications weren't getting responses, takes 5 minutes and the report is genuinely useful.{' '}
                  <span style={{ color: isDark ? '#5eead4' : TEAL, fontStyle: 'normal', fontWeight: 600 }}>{referralLink}</span>"
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Copy message', copied: msgCopied, onClick: () => { navigator.clipboard.writeText(shareMsg); setMsgCopied(true); setTimeout(() => setMsgCopied(false), 2500); } },
                    { label: 'Copy link',    copied: linkCopied, onClick: () => { navigator.clipboard.writeText(referralLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); } },
                  ].map(({ label, copied, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: copied
                          ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.10)')
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        border: `1px solid ${copied ? 'rgba(34,197,94,0.30)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)')}`,
                        borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700,
                        color: copied ? '#22c55e' : theme.sub,
                        cursor: 'pointer', transition: 'all 0.18s', minHeight: 44,
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied!' : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dashboard skip */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={onDone}
                  style={{ background: 'none', border: 'none', color: isDark ? '#374151' : '#9ca3af', fontWeight: 500, cursor: 'pointer', fontSize: 13 }}
                >
                  Already have an account? Go to the dashboard →
                </button>
              </div>

              {/* Feedback widget — bottom-of-report placement so it doesn't
                  interrupt the read. Quiet ask, after the user has had the
                  full experience and the primary CTA. */}
              <div style={{ marginTop: 40 }}>
                <SocialProofWidget isDark={isDark} theme={theme} />
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ── Sticky bar ── */}
      <AnimatePresence>
        {showSticky && sections.length > 0 && (
          <motion.div
            className="no-print"
            initial={{ y: 88, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 88, opacity: 0 }}
            transition={{ ease: [0.25, 1, 0.5, 1], duration: 0.3 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              background: theme.stickyBg, borderTop: `1px solid ${theme.stickyBorder}`,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.16)',
              padding: '12px 24px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.heading, textAlign: 'center' }}>
              {stickyHeadline}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a
                href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer"
                style={{
                  background: isDark ? `rgba(15,118,110,0.12)` : `rgba(15,118,110,0.09)`,
                  border: '1px solid rgba(15,118,110,0.30)',
                  color: isDark ? '#34d399' : TEAL, borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 44,
                  display: 'inline-flex', alignItems: 'center',
                }}
              >
                Free frameworks & weekly guidance (Skool)
              </a>
              <button
                onClick={onDone}
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)', color: 'white',
                  borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800,
                  border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(236, 72, 153, 0.3)',
                  whiteSpace: 'nowrap', minHeight: 44,
                }}
              >
                Build your interview-ready resume, Free →
              </button>
              <button
                onClick={() => setShowSticky(false)}
                aria-label="Dismiss"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isDark ? '#4b5563' : '#9ca3af', padding: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
                }}
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
