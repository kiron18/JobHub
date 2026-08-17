/* ────────────────────────────────────────────────────────────────────────────
   SessionSignupPage — registration for the live group workshop
   Route: /session, /webinar, /register  (public)

   THE ONE RULE FOR THIS PAGE: the people who land here were sent a link and
   told there is a workshop. They arrive wanting the join link and nothing else.
   So the page asks for the least it can (email, and a name to say it with),
   hands the link over immediately, and only then asks for anything more.

   ⚠️ This page does NOT give away the free resource pack, and must not start.
   That is what /free/:slug and /free/all are for. A page that tries to be a
   registration and a lead magnet at once is worse at both: the pack turns the
   registration into a transaction, and the questions people will answer for a
   pack are questions they will not answer for a link they were already promised.

   ⚠️ The resume is OPTIONAL and stays optional. It is the only personalisation
   input left on the page, and the ask is worth more when it costs nothing to
   refuse. There is no skip-reason interrogation any more.

   The trip to the Skool group is deliberately AFTER the link, never in front of
   it. It is framed as the thing to do while waiting, with a reason that is true
   and is in their own interest: the running order comes from that thread.

   ⚠️ The confirmation screen assumes the reader has never heard of Skool and
   does not know what a "group" is. That is why the pack is a grid of twelve
   ticks rather than a sentence naming four of them, and why the group gets
   introduced in a full sentence before any claim is made about it. Do not
   collapse either back into prose to save vertical space.

   ⚠️ The locked PLATFORM block sits inside a section about things that cost
   nothing, so it has to keep saying so: locks rather than ticks, and "None of
   it gates the twelve above" as the first line inside it. It is also folded
   shut by default, because a list of what you do not have is a poor last
   impression on a page whose whole job is to leave someone feeling equipped.

   Pull the roster before the workshop:
     /api/session-signup/export?key=…            counts
     /api/session-signup/export?key=…&format=csv the spreadsheet
   Note that with the qualifying questions removed, the export is now a roster
   rather than a pre-call read. The reading material is the Skool thread and the
   resumes people chose to upload.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import {
  Upload, Check, X, Loader2, ArrowRight, MessageCircle, Copy, Video, Lock, ChevronRight,
} from 'lucide-react';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ── The workshop ──────────────────────────────────────────────────────────────
const SESSION = {
  title: '"Your first Aussie Job" Workshop',
  // No `when` here on purpose. The date comes from /session-signup/next so it
  // follows the weekly schedule instead of going stale the day after it is set.
  portrait: '/Assets/kiron-workshop.png',
  // Deliberately no em dashes anywhere in this copy.
  blurb:
    'One hour, live, and small enough that you can talk. I go through what is actually stopping international graduates from getting interviews here, and you leave knowing which one of those things is yours and what to do about it this week.',
  // Three lines, because "what happens on the call" is the only thing anyone
  // weighing an hour of their evening actually wants to know.
  agenda: [
    'The three ways people genuinely land roles here, and why applying online is the weakest of them',
    'What Australian employers read your resume for, which is not what you were told back home',
    'Live questions, taken from the group thread, answered in front of everyone',
  ],
};

/**
 * The pack, shown as a grid rather than named in a sentence.
 *
 * The old copy named four resources in prose and left the rest as "the rest of
 * the pack", which asks the reader to take the size of it on faith. People who
 * have never seen a Skool group do not know what they are being invited into,
 * so the volume has to be visible in one glance instead of described.
 *
 * ⚠️ Keep this list in step with FREE_RESOURCES in src/config/freeResources.ts.
 * There are twelve, TOTAL_RESOURCES is twelve, and the heading above says
 * twelve. Adding a thirteenth resource means editing three places, not one.
 * Names are shortened for grid density but must stay recognisably the same
 * asset, because this is the list they will go looking for once inside.
 */
const PACK = [
  'Starter Kit',
  'Market Rules Cheat Sheet',
  'Resume Template + Before and After',
  'Cover Letter Template',
  'Selection Criteria Worksheet',
  'Application Tracker',
  'Follow-up Email Swipe File',
  'System Templates',
  'Accredited Visa Sponsor List (3,875 companies)',
  'LinkedIn Outreach Templates',
  'Networking Pack',
  'Interview Scripts and Question Bank',
];

/**
 * The member platform, folded away under a summary line and opened on request.
 *
 * Collapsed by default and on purpose. Open, sitting under a grid of twelve
 * things they are getting, it reads as a list of things they are NOT getting,
 * and a page whose job is to make someone feel equipped should not end by
 * making them feel short-changed. Closed, it is an invitation to look.
 *
 * ⚠️ It still must not read as a gate on the pack, and losing the price line
 * cost it one of its three honesty signals. The two that remain are load
 * bearing: locks instead of ticks, and "None of it gates the twelve above"
 * as the first line inside. Do not remove either.
 *
 * ⚠️ Every line here must be a feature that actually ships. This list is read
 * by people who will buy on the strength of it, so nothing aspirational.
 */
const PLATFORM = [
  'Weekly calls to look at where you are and plan the week ahead',
  'Your resume rewritten for each job you apply to',
  'Cover letters written for the specific role',
  'Pre-written answers to the open application questions',
  'LinkedIn outreach drafts, including the referral follow-up',
  'Follow-up emails written from the job ad itself',
  'Interview prep built from the role you are up for',
  'A tracker that runs itself, so you can see what is actually working',
  'Exclusive access to new tools as they land',
];

/**
 * The four lines someone can post instead of composing a question.
 *
 * The ask used to be "post the one thing stopping you", which quietly requires
 * a self-diagnosis first. Most people at this stage do not have one and will
 * not admit it, so they post nothing. Four blanks with a permitted "not sure"
 * turns an essay into a form, and the shape of the answers is diagnostic on
 * its own, which is what the line under the box promises.
 */
const POST_FORMAT: [string, string][] = [
  ['Looking since', 'March'],
  ['Applications', 'around 60'],
  ['Interviews so far', '1'],
  ['What I think is wrong', 'not sure'],
];

/**
 * Grid breakpoints, as a stylesheet because inline styles cannot hold a media
 * query and the whole point of these two blocks is that they reflow.
 *
 * Two columns on mobile, never one. A single column turns the pack into a long
 * scrolling list, which reads as a to-do rather than as an amount of stuff, and
 * loses the only thing the grid was built to do.
 */
const GRID_CSS = `
.sess-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px 18px; }
.sess-paid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px 18px; }
@media (max-width: 620px) {
  .sess-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
  .sess-paid { grid-template-columns: 1fr; gap: 9px; }
}
`;

/** One line of either grid. Tick when it is theirs already, lock when it is not. */
function GridItem({ label, locked }: { label: string; locked?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {locked
        ? <Lock size={13} color={colors.accentGold} style={{ flex: '0 0 auto', transform: 'translateY(4px)' }} />
        : <Check size={15} color={colors.success} strokeWidth={2.5} style={{ flex: '0 0 auto', transform: 'translateY(3px)' }} />}
      <span style={{
        fontSize: '0.875rem', lineHeight: 1.45,
        color: locked ? colors.textMuted : colors.textSecondary,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: '1rem',
  fontWeight: 600,
  color: colors.textPrimary,
  lineHeight: 1.4,
  display: 'block',
};

const helpStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: '0.875rem',
  color: colors.textMuted,
  lineHeight: 1.55,
  marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 10,
  border: `1px solid ${colors.borderDefined}`,
  background: colors.bgSurface,
  fontFamily: typeTokens.body,
  fontSize: '1rem',
  color: colors.textPrimary,
  outline: 'none',
  boxSizing: 'border-box',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.14em',
  textTransform: 'uppercase', margin: 0,
};

/**
 * The dark banner that says when.
 *
 * Shared by both screens on purpose: the date is the single fact everyone who
 * lands here is looking for, so it should not appear in one weight before they
 * register and another weight after. The confirmation screen passes the join
 * link in as children; the invite screen passes nothing, because there is no
 * link to give until they have registered.
 *
 * The date is the display-size line and the countdown is the small badge, not
 * the other way around. A countdown answers "how long", but people are trying
 * to answer "can I be there", and that needs the actual day and time.
 */
function WhenBanner({ whenLabel, untilLabel, children }: {
  whenLabel: string; untilLabel: string; children?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '26px 24px', borderRadius: 16,
      background: colors.bgDeep, color: colors.textOnDeep,
      boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 10px 30px rgba(26,24,20,0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <Video size={17} color={colors.accentGold} style={{ flex: '0 0 auto' }} />
        <span style={{ ...eyebrowStyle, color: colors.accentGold }}>Live workshop</span>
      </div>

      <p style={{
        fontFamily: typeTokens.display, fontWeight: 500,
        fontSize: 'clamp(1.5rem, 5.5vw, 2.125rem)',
        lineHeight: 1.2, letterSpacing: '-0.015em', margin: 0,
      }}>
        {whenLabel}
      </p>

      {untilLabel && (
        <span style={{
          display: 'inline-block', marginTop: 14,
          padding: '6px 13px', borderRadius: 999,
          background: 'rgba(197,160,89,0.16)', border: '1px solid rgba(197,160,89,0.34)',
          color: colors.accentGold, fontSize: '0.875rem', fontWeight: 600,
        }}>
          {untilLabel}
        </span>
      )}

      {children}
    </div>
  );
}

function Field({ children, label, help, error }: {
  children: React.ReactNode; label: string; help?: string; error?: boolean;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={labelStyle}>{label}</label>
      {help && <p style={helpStyle}>{help}</p>}
      <div style={{ marginTop: 10 }}>{children}</div>
      {error && (
        <p style={{ ...helpStyle, color: '#B4432F', marginTop: 8 }}>This one’s needed.</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Set when the email came off the resume rather than out of their keyboard,
  // so the field can ask them to confirm it instead of silently trusting a regex.
  const [emailFromResume, setEmailFromResume] = useState(false);
  const [parsing, setParsing] = useState(false);

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // The member platform block. Shut until they ask, so the page does not end on
  // a list of things they are not getting. See the note on PLATFORM.
  const [showPlatform, setShowPlatform] = useState(false);

  // Both come back from the register call so there is one source of truth for
  // each link, shared with the confirmation email.
  const [meetLink, setMeetLink] = useState('');
  const [skoolUrl, setSkoolUrl] = useState('');
  // Returned by the registration. Rides on the community link so the click that
  // follows can be stamped against this person on the sales board.
  const [leadId, setLeadId] = useState('');

  /**
   * The real date of the next workshop, asked for on load.
   *
   * Fetched rather than written into the page because the schedule rolls itself
   * weekly on the server. A date typed in here would be right once and quietly
   * wrong every week after.
   */
  const [startsAt, setStartsAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/session-signup/next`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.startsAt) return;
        const parsed = new Date(d.startsAt);
        if (!Number.isNaN(parsed.getTime())) setStartsAt(parsed);
      })
      // A missing date costs the header its specificity and nothing else. The
      // form still works, so this must never surface as an error.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /**
   * Rendered in the reader's own timezone, not in ours.
   *
   * A good share of this audience is still offshore. "7:00 pm AEST" makes them
   * do the arithmetic and some of them get it wrong and miss the room, so the
   * browser converts it and names the zone it converted to.
   */
  const whenLabel = useMemo(() => {
    if (!startsAt) return 'Live workshop, weekly';
    const now = new Date();
    const time = startsAt.toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
    if (startsAt.toDateString() === now.toDateString()) return `Today, ${time}`;
    const day = startsAt.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return `${day}, ${time}`;
  }, [startsAt]);

  /**
   * "Starts in 3 days". The wait is the point: these people were promised a
   * link and they now have one, so the only thing left to give them is a sense
   * that something is coming. A date alone does not do that, a countdown does.
   */
  const untilLabel = useMemo(() => {
    if (!startsAt) return '';
    const ms = startsAt.getTime() - Date.now();
    if (ms <= 0) return 'Happening now';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `Starts in ${mins} minute${mins === 1 ? '' : 's'}`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `Starts in ${hrs} hour${hrs === 1 ? '' : 's'}`;
    const days = Math.round(hrs / 24);
    return `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }, [startsAt]);

  /**
   * "before Tuesday", or just "before then" when we have no date yet.
   *
   * Never hardcode the weekday. WORKSHOP_DAY is an environment variable, so a
   * literal "Tuesday" in the copy would be a lie the day Kiron moves the
   * session and nobody would think to grep a page for it.
   */
  const beforeLabel = useMemo(() => {
    if (!startsAt) return 'before then';
    if (startsAt.toDateString() === new Date().toDateString()) return 'before we start';
    return `before ${startsAt.toLocaleDateString(undefined, { weekday: 'long' })}`;
  }, [startsAt]);

  /**
   * Read the resume the moment it is picked, and pre-fill whatever it gives us.
   * Never overwrite something they typed themselves, and never block on this:
   * the file is already held in state, so a slow or failed parse costs them
   * nothing but the convenience.
   */
  const parseResume = async (f: File) => {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('resume', f);
      const res = await fetch(`${API_BASE}/session-signup/parse-resume`, { method: 'POST', body: fd });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.email && !email.trim()) {
        setEmail(String(data.email));
        setEmailFromResume(true);
        setErrors((p) => { const n = new Set(p); n.delete('email'); return n; });
      }
      if (data.name && !name.trim()) {
        setName(String(data.name));
        setErrors((p) => { const n = new Set(p); n.delete('name'); return n; });
      }
    } catch {
      // Silent on purpose. They fill the two fields the old way.
    } finally {
      setParsing(false);
    }
  };

  const validate = () => {
    const bad = new Set<string>();
    if (!name.trim()) bad.add('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) bad.add('email');
    setErrors(bad);
    return bad.size === 0;
  };

  const submit = async () => {
    setServerError('');
    if (!validate()) {
      const first = document.querySelector('[data-error="true"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      if (file) fd.append('resume', file);

      const res = await fetch(`${API_BASE}/session-signup/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      if (data.meetLink) setMeetLink(data.meetLink);
      if (data.skoolUrl) setSkoolUrl(data.skoolUrl);
      if (typeof data.leadId === 'string') setLeadId(data.leadId);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some embedded browsers. The link is visible and
      // selectable right next to the button, so there is nothing to recover.
    }
  };

  // index.css sets `body { overflow: hidden }` and pins #root to 100vh, so the
  // app is a fixed-viewport shell and every public page has to own its own
  // scroll container. minHeight alone silently makes the page unscrollable.
  const page: React.CSSProperties = {
    height: '100vh',
    overflowY: 'auto',
    background: colors.bgCanvas,
    padding: '56px 20px 96px',
    fontFamily: typeTokens.body,
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = { maxWidth: spacing.containerReadable, margin: '0 auto' };
  const eyebrow: React.CSSProperties = { ...eyebrowStyle, color: colors.accentPetrol };

  // ── Confirmed. The link, then the group. ────────────────────────────────────
  if (done) {
    const community = skoolUrl || 'https://www.aussiegradcareers.com.au/community';
    const communityHref =
      `${community}${community.includes('?') ? '&' : '?'}src=confirm` +
      (leadId ? `&lead=${encodeURIComponent(leadId)}` : '');

    return (
      <div style={page}>
        <div style={shell}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: colors.success,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
            }}>
              <Check size={22} color="#fff" strokeWidth={2.5} />
            </div>
            <h1 style={{
              fontFamily: typeTokens.display, fontWeight: 500, fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              color: colors.textPrimary, letterSpacing: '-0.015em', margin: 0,
            }}>
              You’re in{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}.
            </h1>
          </div>

          {/* The link. First thing on the screen, because it is the only thing
              they were promised and the only reason they filled anything in. */}
          <WhenBanner whenLabel={whenLabel} untilLabel={untilLabel}>
            {meetLink ? (
              <>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                  marginTop: 20, padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(250,247,242,0.08)', border: '1px solid rgba(250,247,242,0.16)',
                }}>
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: '1 1 240px', minWidth: 0, fontSize: '1rem', fontWeight: 600,
                      color: colors.textOnDeep, wordBreak: 'break-all', textDecoration: 'none',
                    }}
                  >
                    {meetLink}
                  </a>
                  <button
                    type="button"
                    onClick={copyLink}
                    style={{
                      flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                      background: copied ? colors.success : colors.textOnDeep,
                      color: copied ? '#fff' : colors.bgDeep,
                      border: 'none', fontFamily: typeTokens.body,
                      fontSize: '0.875rem', fontWeight: 600,
                      transition: 'background 180ms cubic-bezier(0.25, 1, 0.5, 1)',
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{
                  fontSize: '0.875rem', color: 'rgba(250,247,242,0.62)',
                  lineHeight: 1.55, margin: '12px 0 0',
                }}>
                  Sent to {email.trim()} as well, along with a reminder before we start.
                  If it is not there in a few minutes, check spam.
                </p>
              </>
            ) : (
              <p style={{
                fontSize: '1rem', color: 'rgba(250,247,242,0.80)',
                lineHeight: 1.6, margin: '20px 0 0',
              }}>
                Your seat is saved. The join link is on its way to {email.trim()}.
              </p>
            )}
          </WhenBanner>

          {/* The group. After the link, never in front of it. The reason to go
              is true and is in their own interest, which is the only reason
              anyone does a second thing on a confirmation page. */}
          <div style={{
            marginTop: 32, padding: '26px 24px', borderRadius: 16,
            background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
            boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 8px 28px rgba(26,24,20,0.05)',
          }}>
            <style>{GRID_CSS}</style>

            {/* "Step 2 of 2" rather than "do this before Tuesday". A deadline on
                a chore reads as an obligation; a half-finished progress marker
                reads as something they started and want to close. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <MessageCircle size={19} color={colors.accentPetrol} style={{ flex: '0 0 auto' }} />
              <p style={eyebrow}>Step 2 of 2</p>
            </div>

            {/* The question leads, because the pack is a promise anyone can
                make and airtime on a live call is not. The grid underneath does
                the convincing, because wanting the pack takes no self-knowledge
                and knowing your own question does. */}
            <h2 style={{
              fontFamily: typeTokens.display, fontWeight: 500, fontSize: '1.5rem',
              color: colors.textPrimary, margin: '0 0 10px', letterSpacing: '-0.01em',
            }}>
              Get your question answered, plus all 12 resources up front
            </h2>
            <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 20px' }}>
              All of it is already sitting in the group, free and without a card. Take it now and
              give yourself a head start.
            </p>

            <div className="sess-grid" style={{ marginBottom: 14 }}>
              {PACK.map((item) => <GridItem key={item} label={item} />)}
            </div>

            <p style={{ ...helpStyle, marginTop: 0, marginBottom: 24 }}>
              Plus the 9 training modules, the searchable register of all 36,644 approved
              sponsors, and every live call recorded.
            </p>

            {/* The member platform, folded shut. Open by default it turns the
                page's last impression into a list of things they do not have,
                which is the opposite of what the twelve ticks above just did.
                Shut, it is a door they can choose to open, and the ones who
                open it are telling us something worth knowing. */}
            <div style={{
              borderRadius: 12, marginBottom: 26, overflow: 'hidden',
              background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
            }}>
              <button
                type="button"
                onClick={() => setShowPlatform((v) => !v)}
                aria-expanded={showPlatform}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '15px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: typeTokens.body, fontSize: '0.9375rem',
                  fontWeight: 600, color: colors.textPrimary,
                }}
              >
                {/* Points RIGHT when shut, down when open. A chevron already
                    pointing down on a closed block reads as an open one that
                    failed to render its contents. */}
                <ChevronRight
                  size={17}
                  color={colors.accentPetrol}
                  style={{
                    flex: '0 0 auto',
                    transform: showPlatform ? 'rotate(90deg)' : 'none',
                    transition: 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                />
                See what our premium members have access to
              </button>

              {showPlatform && (
                <div style={{ padding: '0 20px 18px' }}>
                  {/* First line inside, always. Without the price line this is
                      the only thing left saying the twelve above are not gated. */}
                  <p style={{ ...helpStyle, marginTop: 0, marginBottom: 14 }}>
                    None of it gates the twelve above. It is the same method with the work done for you.
                  </p>
                  <div className="sess-paid">
                    {PLATFORM.map((item) => <GridItem key={item} label={item} locked />)}
                  </div>
                  {/* What it is worth, not what it costs. The price belongs on
                      the pricing page, where someone has gone looking for it. */}
                  <p style={{ ...helpStyle, marginTop: 14, marginBottom: 0 }}>
                    What it really buys you is the end of the guessing. Your week turns into a
                    short, repeatable list you can work through every day, without wondering
                    whether you are doing the right thing.
                  </p>
                </div>
              )}
            </div>

            {/* What the group is, introduced rather than walked into mid-thought.
                No "cheapest way to reach me" here: pricing your own access down
                in your own copy is a discount you never stop paying for. */}
            <p style={{ fontSize: '1rem', color: colors.textSecondary, lineHeight: 1.65, margin: '0 0 14px' }}>
              The group is the simplest way to get everything I have built, whenever you want it,
              alongside other people working through the same thing at the same time.
            </p>
            <p style={{ fontSize: '1rem', color: colors.textSecondary, lineHeight: 1.65, margin: '0 0 14px' }}>
              New resources land there first. I build something most weeks and it goes up the day
              it is finished. The training sits in there too, nine modules, in order, nothing held
              back. And anything I open up goes to the group before it goes anywhere else.
            </p>

            {/* The instruction half. Ruled off in gold so it stops reading as
                more selling and starts reading as a thing to actually do. */}
            <div style={{
              borderLeft: `2px solid ${colors.accentGold}`,
              paddingLeft: 18, margin: '26px 0 24px',
            }}>
              <p style={{
                fontFamily: typeTokens.display, fontWeight: 500, fontSize: '1.1875rem',
                color: colors.textPrimary, margin: '0 0 10px', letterSpacing: '-0.01em',
              }}>
                Test it {beforeLabel}.
              </p>
              <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.65, margin: '0 0 14px' }}>
                Post the one thing that is actually stopping you in the Webinar Questions thread.
                I build the running order from that thread before we go live, so what gets posted
                is what the session becomes.
              </p>

              {/* Four blanks instead of a blank page. The example values are
                  muted so this reads as a template to copy rather than as
                  somebody else's post to compare yourself against. */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: colors.bgCanvas, border: `1px solid ${colors.borderWhisper}`,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '0.8125rem', lineHeight: 1.9,
              }}>
                {POST_FORMAT.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{k}:</span>
                    <span style={{ color: colors.textMuted }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* The line that gets the quiet ones to post. Not knowing your own
                  problem is reframed as itself diagnostic, which is true, and
                  which flatters instead of exposing. */}
              <p style={{ ...helpStyle, marginTop: 12 }}>
                No question yet? Post those four lines and leave the last one blank. That pattern
                on its own tells me where it is breaking, and it is almost never where people expect.
              </p>

              {/* Ranking is stated only alongside the guarantee. On its own,
                  "most liked goes first" tells a shy person they will lose. */}
              <p style={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.65, margin: '14px 0 0' }}>
                Everyone gets answered. The most liked go first, so if somebody has already
                written your problem better than you could, like theirs and add your detail
                underneath instead of starting a new one.
              </p>
            </div>

            <a
              href={communityHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: colors.accentPetrol, color: colors.textOnDeep,
                padding: '17px 32px', borderRadius: 12, border: 'none',
                fontWeight: 600, fontSize: '1.0625rem', fontFamily: typeTokens.body,
                cursor: 'pointer', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 6px 20px rgba(45,90,110,0.22)',
              }}
            >
              Open the group and post my question
              <ArrowRight size={20} />
            </a>
            <p style={{ ...helpStyle, textAlign: 'center', marginTop: 12 }}>
              Takes about 20 seconds. No card, ever.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── The invite ──────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <div style={shell}>
        {/* The date, before anything else. They were told there is a workshop,
            so the first question in their head is "when", and it should not
            take a different shape here than it does on the screen after this
            one. Same banner, minus the link they have not earned yet. */}
        <div style={{ marginBottom: 30 }}>
          <WhenBanner whenLabel={whenLabel} untilLabel={untilLabel} />
        </div>

        {/* Header. Portrait sits beside the copy on desktop and drops above it
            on narrow screens, which is why this wraps rather than using a grid. */}
        <div style={{
          marginBottom: 28, display: 'flex', flexWrap: 'wrap-reverse',
          // wrap-reverse flips the cross axis, so flex-end is the visual top.
          // It also puts the portrait above the copy once this wraps on mobile.
          gap: 28, alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h1 style={{
              fontFamily: typeTokens.display, fontWeight: 500,
              fontSize: 'clamp(1.875rem, 6vw, 2.375rem)',
              color: colors.textPrimary, letterSpacing: '-0.015em', margin: '0 0 14px',
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}>
              {SESSION.title}
            </h1>
            <p style={{
              fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0,
            }}>
              {SESSION.blurb}
            </p>
          </div>

          <img
            src={SESSION.portrait}
            alt="Kiron, who runs the workshop"
            style={{
              width: 'clamp(112px, 20vw, 176px)',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              // The headshot sits high in the frame, so bias the crop upward.
              objectPosition: 'center 18%',
              borderRadius: '50%',
              background: colors.bgSurface,
              border: `1px solid ${colors.borderWhisper}`,
              flex: '0 0 auto',
              marginTop: 6,
            }}
          />
        </div>

        {/* What actually happens in the hour. The only thing worth saying to
            someone deciding whether to spend an evening on this. */}
        <ul style={{
          listStyle: 'none', margin: '0 0 28px', padding: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {SESSION.agenda.map((line) => (
            <li key={line} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <Check size={17} color={colors.success} style={{ flex: '0 0 auto', transform: 'translateY(3px)' }} />
              <span style={{ fontSize: '1rem', color: colors.textSecondary, lineHeight: 1.55 }}>
                {line}
              </span>
            </li>
          ))}
        </ul>

        <div style={{
          background: colors.bgSurface, borderRadius: 16, padding: '30px 28px',
          border: `1px solid ${colors.borderWhisper}`,
          boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 8px 28px rgba(26,24,20,0.05)',
        }}>
          <div data-error={errors.has('name')}>
            <Field label="Your name" error={errors.has('name')}>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('name'); return n; }); }}
                placeholder="First and last"
                autoComplete="name"
              />
            </Field>
          </div>

          <div data-error={errors.has('email')}>
            <Field
              label="Email"
              help={
                emailFromResume
                  ? 'I found this on your resume. If it is not the inbox you actually check, change it now, because this is where the link goes.'
                  : 'The join link goes here, and a reminder before we start.'
              }
              error={errors.has('email')}
            >
              <input
                style={{
                  ...inputStyle,
                  ...(emailFromResume ? { borderColor: colors.accentPetrol, background: colors.bgAlt } : {}),
                }}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailFromResume(false);
                  setErrors((p) => { const n = new Set(p); n.delete('email'); return n; });
                }}
                placeholder="you@email.com"
                type="email"
                autoComplete="email"
              />
            </Field>
          </div>

          {/* Optional, and it says so in the label rather than in small print
              underneath. An optional ask that looks required is just a required
              ask that people resent. */}
          <Field
            label="Your resume, optional"
            help="I read these before the session and the examples I use on the call come out of them. If yours is here, some of the hour is about you. Skip it and nothing bad happens."
          >
            {file ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderRadius: 10, background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
              }}>
                {parsing
                  ? <Loader2 size={18} className="animate-spin" color={colors.textMuted} />
                  : <Check size={18} color={colors.success} />}
                <span style={{
                  flex: 1, fontSize: '0.9375rem', color: colors.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {parsing ? 'Reading it…' : file.name}
                </span>
                <button
                  type="button"
                  onClick={() => { setFile(null); setEmailFromResume(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                  aria-label="Remove file"
                >
                  <X size={16} color={colors.textMuted} />
                </button>
              </div>
            ) : (
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '18px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px dashed ${colors.borderDefined}`,
                background: colors.bgCanvas, color: colors.textSecondary,
                fontSize: '0.9375rem', fontWeight: 500,
              }}>
                <Upload size={18} />
                Upload it (PDF, DOCX or TXT)
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    if (f) void parseResume(f);
                  }}
                />
              </label>
            )}
          </Field>

          {serverError && (
            <p style={{
              fontSize: '0.9375rem', color: '#B4432F', background: 'rgba(180,67,47,0.07)',
              padding: '12px 14px', borderRadius: 10, margin: '0 0 18px',
            }}>
              {serverError}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            style={{
              width: '100%', background: colors.accentPetrol, color: colors.textOnDeep,
              padding: '17px 32px', borderRadius: 10, border: 'none',
              fontWeight: 600, fontSize: '1.0625rem', fontFamily: typeTokens.body,
              cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
            }}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? 'Saving your seat…' : 'Send me the link'}
          </button>

          <p style={{ ...helpStyle, textAlign: 'center', marginTop: 13 }}>
            No account needed. Your resume isn’t shared with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
