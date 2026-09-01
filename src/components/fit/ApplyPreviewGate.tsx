/**
 * What a free account sees when it asks us to write the application.
 *
 * The sequence is deliberate and it is the whole pitch: they paste a job, we
 * give them a straight answer about it for nothing, and when they say "write it
 * then", the machine runs, a document appears, and it is theirs the moment they
 * pay. Nothing here is a trick played on them: the wait is real work being
 * described honestly (it is what a paid run actually does, in the order it does
 * it), and the page behind the offer is their own resume, not a fabricated one.
 *
 * NOTHING IS GENERATED HERE. No LLM call is made, and no document is written,
 * for an account that cannot have it. The blurred page is the candidate's own
 * baseline resume, which they already own and were emailed, standing in for the
 * tailored version they are being offered. That distinction matters if this is
 * ever changed: showing a real generation and then withholding it would burn
 * both the credits and the trust.
 *
 * A paying account never reaches this component. FitCheckPage sends them to the
 * real workspace instead.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { type as landingType } from '../landing/tokens';
import { trackUpgradeModalOpened, trackCheckoutStarted, trackFreeLimitHit } from '../../lib/analytics';
import { SALES_PAGE_URL } from '../../lib/salesPage';
import { splitAtFirstSection } from '../../lib/resumeHead';
import { embeddedCheckoutEnabled } from '../../lib/embeddedCheckout';
import { EmbeddedCheckoutPanel } from './EmbeddedCheckoutPanel';

const C = warm.colors;
const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * The build sequence, in the order a paid run actually performs it.
 *
 * Keep these honest. The moment a line describes something the paid product
 * does not do, the free user who buys on the strength of it has been sold
 * something else, and they find out on their first real generation.
 */
/**
 * The three beats, in order, and why the screen is built around them.
 *
 *   1. BOOT     a log of work starting, over an empty page.
 *   2. PRINT    the page fills, in the clear, and they watch it happen.
 *   3. SEAL     the moment it reaches writing we have not been paid for,
 *               the whole page softens and the offer lands on it.
 *
 * The order is the argument. Anticipation is built by showing the thing being
 * made, in full view, and it is only worth anything if what they watched was
 * genuinely theirs: the page that prints is their own resume, read out of their
 * own profile. Nothing is generated here and no LLM call is made. If that ever
 * changes, the sequence has to change with it, because a real generation shown
 * and then withheld is a different product and a worse one.
 */

/**
 * The boot log.
 *
 * Present tense, no full stops, monospace: this is the machine talking to
 * itself, not the product talking to the customer. Every line names something
 * that actually happens on a run, in the order it happens, which is why they
 * are short enough to read at a glance and why none of them promises an
 * outcome. They run over an empty page, so the first thing that appears in the
 * document is the candidate's own name and not a placeholder.
 */
const BOOT_LINES = [
  'opening your profile',
  'reading the ad you pasted',
  'pulling your roles, dates and education',
  'matching your history against the ad',
] as const;

/** Fast. This is the throat-clearing, not the show. */
const BOOT_LINE_MS = 620;

/**
 * What is said while the page fills.
 *
 * One line per beat of the print, and they sit in a thin strip at the bottom
 * rather than a card in the middle, because the whole point of this phase is
 * that nothing covers the document. Keep them honest: the moment a line
 * describes something the paid product does not do, the person who bought on
 * the strength of it finds out on their first real generation.
 */
const PRINT_LINES = [
  'Rewriting your resume for this employer.',
  'Writing the cover letter that answers this ad.',
  'Checking every claim against your own history.',
] as const;

/**
 * How long their own details take to print.
 *
 * Tuned to be read, not raced. Too fast and it is a flicker they miss, which
 * costs the whole phase its job; too slow and they leave before the offer. The
 * head is a fixed duration rather than a fixed character rate on purpose, so a
 * candidate with a long address does not sit through a longer wait than one
 * with a short one.
 */
const HEAD_MS = 5200;

/**
 * The overlap, in characters and in time.
 *
 * The body does not stay hidden until the blur; it starts to arrive, and they
 * see the first line of the summary land before it goes. That crossing is the
 * whole point of the screen: this is where their details stop and our writing
 * starts, and it is the exact line the offer is drawn on.
 */
const BODY_LEAD_CHARS = 90;
const BODY_LEAD_MS = 1100;

/** Small steps on a short tick, so the page grows rather than jumping a paragraph. */
const TYPE_TICK_MS = 32;

/**
 * The seal: the blur closing over the finished page.
 *
 * Fast, and over EVERYTHING, their own name included. Up to this moment the
 * head was crisp because we did not write it and had nothing to withhold. The
 * seal is a different statement: the page is done, and the page is not yours
 * yet. Softening only the half we wrote would say the opposite, that the
 * document is half available, which is not the offer being made.
 */
const SEAL_MS = 700;

/**
 * How hard the finished page is held back.
 *
 * Tuned by what has to survive it, in both directions. It has to be plainly a
 * resume, and plainly THEIR resume, complete and sitting right there: the
 * headings, the column of bullets, the shape of the thing. It also has to be
 * unreadable, or there is nothing left to sell. Past about 4px it stops being a
 * document and turns into wallpaper, which loses the argument the whole screen
 * is making.
 */
const SEAL_BLUR_PX = 3.2;

/**
 * The soft edge on our writing as it arrives, before the seal.
 *
 * Small. This is a hint that the text landing is not the same kind of text as
 * the name above it, not the withholding itself. The seal does that.
 */
const LEAD_BLUR_PX = 1.5;

/**
 * The scrim behind the offer card.
 *
 * Deliberately light. An offer that says "it is already built, it is right
 * behind you" cannot be shown over a page dimmed until it is gone, because
 * then there is visibly nothing behind it. The blur is what makes the document
 * unreadable; this only has to lift the card off it.
 */
const OFFER_SCRIM = 'rgba(15,32,56,0.18)';

/* ─── The offer ────────────────────────────────────────────────────────────── */

/**
 * All of the offer's wording lives here, in one block, because it is the part
 * that gets rewritten most and it should never require reading JSX to edit.
 *
 * The claims are deliberately about what the product does and what it costs,
 * never about outcomes we cannot measure. No invented success rates, no "3x
 * more interviews", and no countdown, because a fake deadline in front of
 * somebody who has been rejected forty times costs more than it earns. If a
 * real one ever exists (a price rise, a cohort date), it can be said plainly.
 */
const OFFER = {
  title: 'Unlock access to your dream job today.',
  subtitle:
    'Unlimited high quality personalised applications sent in minutes that guarantee you getting hired.',

  /*
   * Anchored values, one line each, every one a thing that is actually built.
   * If a line is ever cut from the product, cut it from here the same day: a
   * stack that oversells by one line is a refund request with a receipt.
   */
  stack: [
    { item: 'A resume rewritten for every job you paste', value: '$600' },
    { item: 'A cover letter that answers each ad', value: '$300' },
    { item: 'Selection criteria for government and council roles', value: '$300' },
    { item: 'Interview prep that runs during the call', value: '$250' },
    { item: 'Follow-up emails, written and scheduled', value: '$150' },
    { item: 'Weekly community call with professional guidance', value: '$400' },
    { item: 'Tracker, daily target and the community', value: '$350' },
  ],
  stackTotal: '$2,350',

  price: '$197 per month',
  /* Only true at a month: $197 over about 4.3 weeks. */
  anchor: 'Less than $50 per week.',

  /*
   * The seven days, stated the way checkout actually behaves.
   *
   * `premium` is out of NO_TRIAL_PLANS in server/src/routes/stripe.ts, so the
   * session is created with trial_period_days and the card is charged $0 today.
   * Both halves have to be said in the same breath: the card IS collected, and
   * the $197 DOES land on day eight unless they cancel. "Free trial" on its own
   * reads as "no card", and somebody who believed that and got charged is a
   * chargeback with a screenshot of this box attached.
   */
  trial: 'Free for 7 days. Cancel any time before day 7 and you are not charged.',

  /* The speed claim stands on its own line, directly above the guarantee, because
     it is the sentence that does the selling and the guarantee is what makes it
     safe to believe. */
  speed: 'High quality applications + outreach in just one hour.',

  /*
   * The guarantee, in full, in the box.
   *
   * It is stated with its conditions rather than behind a link, because the
   * conditions are the offer: they are the volume the whole service is built
   * around. A guarantee advertised without its conditions and then refused on
   * them is misleading conduct, so the version the customer reads here is the
   * version we honour, and the refund policy page carries the same words.
   */
  guaranteeName: 'Our guarantee',
  guarantee:
    'Complete 10 applications and 5 outreach messages a day for 7 days straight. If you do that and do not land at least one interview or callback within 30 days of finishing, message us and we will refund every dollar. No questions asked.',

  /*
   * No price on the button.
   *
   * "$197 per month" is already set at 26px directly above it, so the button was
   * charging them twice in the same glance — and the button's own "· $197" said
   * it WITHOUT "per month", which is the one genuinely misleading thing in the
   * box on a recurring plan. The number stays loud where it is accurate; the
   * button names the action, with the guarantee immediately under it.
   */
  cta: 'Start my 7 days free',
  ctaSub: 'Card required. Nothing is charged until day 8.',

  /*
   * The decline is a door, not a dead end.
   *
   * Someone who is not ready to pay is not necessarily gone; they usually want
   * to understand what they would be buying. This sends them to the sales page
   * that the rest of the funnel already points at, rather than dropping them
   * back onto a report they have finished reading.
   */
  decline: 'Let me see how this works',
} as const;

interface Props {
  /** The candidate's own baseline resume, blurred behind the offer. */
  resumeMarkdown: string;
  /** For the line that names what was built, when the report knew them. */
  role?: string | null;
  company?: string | null;
  onClose: () => void;
}

export function ApplyPreviewGate({ resumeMarkdown, role, company, onClose }: Props) {
  const [phase, setPhase] = useState<'boot' | 'print' | 'offer' | 'paying'>('boot');
  const [line, setLine] = useState(0);
  const [loading, setLoading] = useState(false);
  /** How much of the page behind has been "printed" so far, in characters. */
  const [typed, setTyped] = useState(0);
  /**
   * The blur is closing. Its own flag rather than a phase, because the seal and
   * the offer overlap on purpose: the page starts softening and the card lands
   * on top of it while it is still moving. Sealing first and then opening the
   * offer as a separate step reads as two events, and it is meant to read as one.
   */
  const [sealing, setSealing] = useState(false);

  /*
   * The page types itself while the card works.
   *
   * It starts blank and fills in, so what is behind the card is visibly being
   * produced rather than sitting there waiting to be revealed. Blurred, so the
   * only thing that reads is the shape: a name, then headings, then bullets
   * arriving. Paced to finish a little before the card does, because a document
   * that is still being written when the offer appears looks unfinished.
   *
   * Smaller steps on a shorter tick than the eye needs, so the text grows rather
   * than jumping a paragraph at a time.
   */
  /*
   * Two halves of one page: their details, and our writing.
   *
   * `typed` runs across both, so the head fills first and the body picks up
   * where it stopped, and the boundary between them is where the print stops
   * and the seal closes. Declared above the effects because the print timer
   * needs the head's length to pace itself.
   */
  const { head, body } = useMemo(() => splitAtFirstSection(resumeMarkdown), [resumeMarkdown]);

  /*
   * BOOT: the log runs, then the page starts printing.
   *
   * Nothing is on the page yet. The document is deliberately empty behind this,
   * so the first thing that ever appears in it is the candidate's own name.
   */
  useEffect(() => {
    if (phase !== 'boot') return;
    if (line >= BOOT_LINES.length - 1) {
      /*
       * With no resume text there is nothing to print, and six seconds of blank
       * paper is not anticipation, it is a broken screen. Rare (the profile is
       * written before anyone reaches a fit check) but it is the one input that
       * turns this sequence into a bug, so it goes straight to the offer.
       */
      const next = resumeMarkdown.length === 0
        ? () => { setSealing(true); setPhase('offer'); }
        : () => { setLine(0); setPhase('print'); };
      const done = window.setTimeout(next, BOOT_LINE_MS);
      return () => window.clearTimeout(done);
    }
    const id = window.setTimeout(() => setLine((n) => n + 1), BOOT_LINE_MS);
    return () => window.clearTimeout(id);
  }, [phase, line, resumeMarkdown.length]);

  /*
   * PRINT: their details fill in, then our writing starts to arrive.
   *
   * Driven off elapsed time rather than a fixed step per tick, so the head
   * always takes HEAD_MS whatever its length: the pace people see is the pace
   * that was tuned, not a function of how long somebody's address is.
   *
   * It stops at BODY_LEAD_CHARS into the body and seals there. That stop is the
   * point of the whole screen, so it is a hard boundary and not a fade-out: the
   * run ends exactly where the writing we are selling begins.
   */
  useEffect(() => {
    if (phase !== 'print') return;
    const headLen = head.length;
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed < HEAD_MS) {
        setTyped(Math.round((elapsed / HEAD_MS) * headLen));
        return;
      }
      const intoBody = Math.min(1, (elapsed - HEAD_MS) / BODY_LEAD_MS);
      setTyped(headLen + Math.round(intoBody * BODY_LEAD_CHARS));
      if (intoBody >= 1) {
        window.clearInterval(id);
        /*
         * The rest of the page fills in on the same tick the seal starts, so
         * what sets behind the offer is a COMPLETE document rather than one
         * that stopped mid-sentence. That is the sentence the offer makes: it
         * is built, it is right there, and it is not yours yet. Under the blur
         * none of it can be read, which is what makes showing it whole safe.
         */
        setTyped(resumeMarkdown.length);
        setSealing(true);
      }
    }, TYPE_TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, head.length, resumeMarkdown.length]);

  /* The narration keeps pace with the print and gets out of the way after it. */
  useEffect(() => {
    if (phase !== 'print') return;
    if (line >= PRINT_LINES.length - 1) return;
    const each = (HEAD_MS + BODY_LEAD_MS) / PRINT_LINES.length;
    const id = window.setTimeout(() => setLine((n) => n + 1), each);
    return () => window.clearTimeout(id);
  }, [phase, line]);

  /*
   * SEAL: the offer lands while the blur is still closing.
   *
   * One beat, not two. The card is timed to arrive before the page has finished
   * softening, so the withholding and the offer read as the same event rather
   * than a thing that happens and then a thing that is sold.
   */
  useEffect(() => {
    if (!sealing) return;
    const id = window.setTimeout(() => setPhase('offer'), SEAL_MS);
    return () => window.clearTimeout(id);
  }, [sealing]);

  useEffect(() => {
    if (phase !== 'offer') return;
    trackUpgradeModalOpened('generation');
    trackFreeLimitHit('generation');
  }, [phase]);

  /*
   * `premium` is the $197/month recurring price this modal advertises. It is
   * not `three_month` (a one-time payment) and not `monthly` (a different price
   * on the pricing page); pointing it at either would charge something other
   * than what the box says.
   */
  const PLAN = 'premium';

  async function checkout() {
    trackCheckoutStarted(PLAN);

    /*
     * In-page payment, when it is switched on.
     *
     * They have just watched their own application being written on this
     * screen. Sending them to another domain to pay for it is the one moment
     * the whole sequence is undone, so behind the flag the form opens here
     * instead. Off — or with no publishable key to mount it — this falls
     * straight through to the redirect that has always worked.
     */
    if (embeddedCheckoutEnabled()) {
      setPhase('paying');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan: PLAN });
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  const forWhat = [role, company].filter(Boolean).join(' at ');

  const headTyped = Math.min(typed, head.length);
  const bodyTyped = Math.max(0, typed - head.length);

  /*
   * Two blurs doing two different jobs.
   *
   * The lead blur is on the body alone and ramps in over its opening line, so
   * our writing arrives visibly softer than the details above it. The seal is
   * on the whole page and closes once, at the end, over all of it.
   */
  const leadBlurPx = (Math.min(1, bodyTyped / BODY_LEAD_CHARS) * LEAD_BLUR_PX).toFixed(2);
  const sealed = sealing || phase === 'offer' || phase === 'paying';
  const pageBlurPx = sealed ? SEAL_BLUR_PX : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: C.bgCanvas, overflow: 'hidden',
    }}>
      {/*
        Their own resume, unreadable on purpose. aria-hidden and inert: it is
        wallpaper, and a screen reader walking a blurred document is nobody's
        idea of an offer.
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, padding: '40px 24px', overflow: 'hidden',
          opacity: 0.96, userSelect: 'none', pointerEvents: 'none',
        }}
      >
        <div style={{
          maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 14,
          border: `1px solid ${C.borderWhisper}`, padding: '40px 44px',
          fontFamily: warm.type.fontBody, fontSize: 14.5, lineHeight: 1.65, color: '#1a2230',
          /* The seal, over the whole document, their name included. It is off
             for the entire print so they watch a page they can actually read
             fill in, and it closes once at the end. */
          filter: `blur(${pageBlurPx}px)`,
          transition: `filter ${SEAL_MS}ms ease-out`,
        }}>
          {/* Their own details. Crisp while it prints, because we did not write
              a word of it and there is nothing here to withhold. */}
          <ReactMarkdown>{head.slice(0, headTyped)}</ReactMarkdown>

          {/* Our writing, arriving a touch softer than the details above it, so
              the boundary between the two is visible before it is named. */}
          <div style={{
            filter: `blur(${leadBlurPx}px)`,
            transition: `filter ${TYPE_TICK_MS * 6}ms linear`,
          }}>
            <ReactMarkdown>{body.slice(0, bodyTyped)}</ReactMarkdown>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'boot' ? (
          /*
            The log, over an empty page.

            A terminal on purpose. The previous version of this screen was a
            spinner and a sentence, which is the visual language of waiting, and
            waiting is the one thing this moment must not feel like. A log
            reads as work being done and it can be scanned rather than read, so
            it holds attention for the two and a half seconds it needs without
            asking for any.

            Every line is an operation that actually runs, so this stays honest
            even though it is theatre: the theatre is in the pacing, not the
            claims.
          */
          <motion.div
            key="boot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <div style={{
              width: '100%', maxWidth: 460,
              background: C.bgDeep, border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14, padding: '22px 24px', boxShadow: warm.shadow.lifted,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 13, lineHeight: 1.9, color: 'rgba(255,255,255,0.92)',
            }}>
              <p style={{
                margin: '0 0 10px', fontSize: 11, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
              }}>
                {forWhat ? `building for ${forWhat}` : 'building your application'}
              </p>
              {/* Lines stay once they land, so the log grows instead of
                  replacing itself. A list that swaps one line for another reads
                  as one thing being retried; a list that accumulates reads as
                  progress, which is what is actually happening. */}
              {BOOT_LINES.slice(0, line + 1).map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}
                >
                  <span style={{ color: C.success }}>{i < line ? '✓' : '›'}</span>
                  <span style={{ opacity: i < line ? 0.6 : 1 }}>{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : phase === 'print' ? (
          /*
            Nothing in the middle of the screen.

            This is the phase the whole sequence exists for, and the one rule is
            that the document is not covered. The narration moves to a strip at
            the bottom edge where it can be read without standing between anyone
            and the page filling in above it.
          */
          <motion.div
            key="print"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              display: 'flex', justifyContent: 'center', padding: '0 24px 28px',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              maxWidth: '100%', padding: '11px 20px', borderRadius: 99,
              background: C.bgSurface, border: `1px solid ${C.borderDefined}`,
              boxShadow: warm.shadow.lifted,
            }}>
              <Loader2 size={15} className="animate-spin" style={{ color: C.accentPetrol, flexShrink: 0 }} />
              <AnimatePresence mode="wait">
                <motion.span
                  key={line}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  style={{ fontSize: 14, color: C.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {PRINT_LINES[line]}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 24, overflowY: 'auto',
              background: OFFER_SCRIM,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              role="dialog"
              aria-modal="true"
              aria-label="Unlock your application"
              style={{
                position: 'relative', width: '100%', maxWidth: 560, margin: 'auto',
                background: C.bgSurface, border: `1px solid ${C.borderDefined}`,
                borderRadius: 22, padding: 'clamp(26px, 4vw, 34px)',
                boxShadow: warm.shadow.lifted,
              }}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
                  color: C.textMuted, cursor: 'pointer', padding: 8, borderRadius: 8,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>

              {phase === 'paying' ? (
                /*
                  The same checkout, mounted here.

                  Deliberately spare: they have already read the offer and
                  decided, so re-selling over the top of a card form is noise.
                  The price is restated once, because a payment form with no
                  amount beside it is the moment people go looking for the
                  amount.
                */
                <>
                  <h2 style={{
                    margin: '0 0 4px', fontFamily: landingType.display, fontWeight: 700,
                    fontSize: 'clamp(20px, 3.6vw, 24px)', letterSpacing: '-0.02em',
                    lineHeight: 1.25, color: C.textPrimary,
                  }}>
                    {OFFER.price}
                  </h2>
                  {/* The form below says "$0.00 due today". Restating the
                      monthly price with nothing to explain it is the moment
                      somebody goes looking for what they are actually paying. */}
                  <p style={{ margin: '0 0 18px', fontSize: 14, color: C.textMuted }}>
                    {OFFER.trial}
                  </p>

                  <EmbeddedCheckoutPanel
                    plan={PLAN}
                    onError={(message) => {
                      // Never strand them on a form that will not load: say what
                      // happened and put the offer back, redirect button and all.
                      toast.error(message);
                      setPhase('offer');
                    }}
                  />

                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setPhase('offer')}
                      style={{
                        background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 13.5, color: C.textMuted,
                        textDecoration: 'underline',
                      }}
                    >
                      Back to what is included
                    </button>
                  </div>
                </>
              ) : (
              <>
              {/* One step from hired: the same track they have seen twice, at its end. */}
              <div style={{
                borderRadius: warm.radius.card, overflow: 'hidden', background: '#fff',
                border: `1px solid ${C.borderWhisper}`, aspectRatio: '1920 / 820',
                maxWidth: 420, margin: '0 auto 20px',
              }}>
                <img
                  src="/Assets/journey/step-5-of-5.png"
                  alt="Your progress: the last step before hired"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%', display: 'block' }}
                />
              </div>

              <h2 style={{
                margin: '0 0 8px', fontFamily: landingType.display, fontWeight: 700,
                fontSize: 'clamp(22px, 4.2vw, 28px)', letterSpacing: '-0.02em',
                lineHeight: 1.22, color: C.textPrimary,
              }}>
                {OFFER.title}
              </h2>
              <p style={{ margin: '0 0 18px', fontSize: 15.5, lineHeight: 1.6, color: C.textSecondary }}>
                {OFFER.subtitle}
              </p>

              <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'grid', gap: 9 }}>
                {OFFER.stack.map(({ item, value }) => (
                  <li key={item} style={{
                    display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'start',
                  }}>
                    <span style={{ color: C.success, marginTop: 2 }}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <span style={{ fontSize: 14.5, lineHeight: 1.5, color: C.textPrimary }}>{item}</span>
                    <span style={{
                      fontSize: 13, color: C.textMuted, whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums', paddingLeft: 8,
                    }}>
                      {value}
                    </span>
                  </li>
                ))}
              </ul>

              {/* The total and the price share the stack's right-hand column, so
                  the eye falls straight down the numbers: value, then cost. */}
              <div style={{
                borderTop: `1px solid ${C.borderDefined}`, paddingTop: 12, marginBottom: 18,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 10,
                  fontSize: 12.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textMuted,
                }}>
                  <span>Total value</span>
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: C.textMuted,
                    textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {OFFER.stackTotal}
                  </span>
                </div>
                <p style={{
                  margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em',
                  color: C.textPrimary, fontVariantNumeric: 'tabular-nums',
                }}>
                  {OFFER.price}
                </p>
                <p style={{ margin: 0, fontSize: 13.5, color: C.textMuted }}>{OFFER.anchor}</p>
                {/* The risk reversal sits with the number it reverses, not down
                    by the button, because the hesitation happens here. */}
                <p style={{
                  margin: '6px 0 0', fontSize: 14, fontWeight: 700, lineHeight: 1.45,
                  color: C.success,
                }}>
                  {OFFER.trial}
                </p>
              </div>

              <p style={{
                margin: '0 0 10px', fontSize: 15.5, fontWeight: 700, lineHeight: 1.45,
                color: C.textPrimary,
              }}>
                {OFFER.speed}
              </p>

              <button
                type="button"
                onClick={checkout}
                disabled={loading}
                style={{
                  width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 9, padding: '15px 24px', background: C.accentPetrol, color: C.textOnDeep,
                  border: 'none', borderRadius: warm.radius.button, fontSize: 16, fontWeight: 700,
                  fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)',
                }}
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : OFFER.cta}
              </button>
              <p style={{ margin: '10px 0 0', fontSize: 13, textAlign: 'center', color: C.textMuted }}>
                {OFFER.ctaSub}
              </p>

              {/*
                The guarantee sits UNDER the button, not above it.

                Above, it was one more thing to read before deciding, and it read
                as part of the pitch. Under the button it is what it actually is:
                the answer to the hesitation someone feels with their finger over
                the price. It is stated with its conditions rather than behind a
                link, because the conditions are the offer, and the version they
                read here is the version we honour.
              */}
              <div style={{
                padding: '13px 16px', marginTop: 16, borderRadius: 12,
                background: 'rgba(18,128,92,0.07)', borderLeft: `3px solid ${C.success}`,
              }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
                  {OFFER.guaranteeName}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 14, lineHeight: 1.55, color: C.textSecondary }}>
                  {OFFER.guarantee}
                </p>
              </div>

              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <a
                  href={SALES_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', padding: 4,
                    fontSize: 13.5, color: C.textMuted, textDecoration: 'underline',
                  }}
                >
                  {OFFER.decline}
                </a>
              </div>
              </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
