/**
 * /check — "See how well your resume fits this job"
 *
 * The one door. Every application starts here now, free or paid, pasted or
 * picked off the feed. Onboarding already has their resume. This screen asks
 * for one thing, a job ad, and gives back one honest answer, and the button
 * that writes the resume lives inside that answer rather than beside it.
 *
 * Three states, one screen: paste, waiting, report. Nothing else is on it. The
 * person arriving here has typically sent a hundred applications into silence,
 * so a screen with six things to choose between is a screen they leave.
 *
 * The wording of the ask is fixed and deliberate. "Check a job" tested as
 * meaningless. "See how well your resume fits this job" says what happens, and
 * "Find out" is what they came to do.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { classifyPaste } from '../lib/seekLink';
import { jdMentionsSelectionCriteria } from '../lib/selectionCriteria';
import { FitReportView, type FitReport } from '../components/fit/FitReportView';
import { ApplyPreviewGate } from '../components/fit/ApplyPreviewGate';

const C = warm.colors;

interface CheckResponse {
  jobId: string;
  report: FitReport;
  /** The ad as the server read it. A Seek link comes back resolved to its text. */
  jobDescription: string;
  alreadyTracked: { status: string; dateApplied: string | null } | null;
}

/**
 * What the dashboard, the job feed and the get-started flow hand over. All of
 * it optional: someone can also land on /check cold and paste an ad.
 */
interface IncomingJob {
  jobDescription?: string;
  url?: string;
  company?: string;
  role?: string;
  agency?: string;
  location?: string;
  feedItemId?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
}

export default function FitCheckPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state ?? null) as IncomingJob | null;

  const [jd, setJd] = useState(incoming?.jobDescription ?? '');
  /** True once a free account has asked us to write the application. */
  const [gating, setGating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  /**
   * The employer, when the ad never named one. Asked here rather than on the
   * dashboard because the check reads the ad anyway, so we only ask when the
   * read genuinely came back empty. A tracker row with no employer cannot be
   * followed up, which is the whole product.
   */
  const [employerAsk, setEmployerAsk] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 60_000,
  });

  const trimmed = jd.trim();
  const pasted = classifyPaste(trimmed);
  // A Seek link is ~35 characters. Judging the paste by what it is rather than
  // how long it is, so a link is not rejected for being short.
  const canSubmit = !checking && (pasted.kind === 'seek-url' || trimmed.length >= 100);

  const runCheck = async (payload: { jobDescription?: string; url?: string }) => {
    setChecking(true);
    try {
      const { data } = await api.post<CheckResponse>('/fit/check', payload);
      setResult(data);
    } catch (err: any) {
      // A missing resume is the one failure with a fix the person can act on,
      // so it goes somewhere rather than showing a red box.
      if (err?.response?.data?.needsResume) {
        toast.error('Upload your resume first, then check a job.');
        navigate('/');
        return;
      }
      toast.error(err?.response?.data?.error ?? 'That did not go through. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleCheck = () => {
    if (!canSubmit) return;
    void runCheck(pasted.kind === 'seek-url' ? { url: pasted.url } : { jobDescription: trimmed });
  };

  /**
   * Arriving with a job already in hand, from the dashboard or the feed. It
   * runs straight away: they already pressed a button, and making them press a
   * second one for the same job is the loop we are trying to delete.
   */
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !incoming) return;
    const hasJob = (incoming.jobDescription?.trim().length ?? 0) >= 100 || !!incoming.url;
    if (!hasJob) return;
    autoRan.current = true;
    void runCheck(
      incoming.url ? { url: incoming.url } : { jobDescription: incoming.jobDescription!.trim() },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const checkAnother = () => {
    setResult(null);
    setEmployerAsk(null);
    setJd('');
    // Drop the handed-over job too, or the auto-run guard is the only thing
    // stopping the same ad reappearing.
    navigate('/check', { replace: true, state: null });
  };

  /**
   * Into generation. The check has already read the ad, so its title and
   * employer are what get carried forward, with anything the caller knew for
   * certain (a feed job knows both) winning over what the model read.
   */
  /**
   * Free accounts do not reach the workspace.
   *
   * They get the build sequence and then the offer, over their own resume. The
   * check they just ran was the free tier's whole promise and it was kept; this
   * is the door, and it is the first place in the flow where money is mentioned.
   *
   * `plan` is the signal, and an admin account is treated as paid so the real
   * workspace stays reachable for testing. A profile that has not loaded yet is
   * treated as PAID, deliberately: showing the offer to somebody who has already
   * bought, because a query was slow, is the one failure here that costs money.
   */
  const isFree = profile ? (profile.plan ?? 'free') === 'free' && !profile.isAdmin : false;

  const goToApply = (companyOverride?: string) => {
    if (!result) return;
    if (isFree) { setGating(true); return; }
    // What the server read, not what sits in the box: pasting a Seek link
    // would otherwise send the generator a URL instead of a job advert.
    const jobDescription = result.jobDescription || trimmed || incoming?.jobDescription || '';
    navigate('/apply', {
      state: {
        jobDescription,
        sc: jdMentionsSelectionCriteria(jobDescription),
        company: incoming?.company ?? companyOverride ?? result.report.company ?? undefined,
        role: incoming?.role ?? result.report.jobTitle ?? undefined,
        agency: incoming?.agency,
        location: incoming?.location,
        feedItemId: incoming?.feedItemId,
        sourceUrl: incoming?.sourceUrl,
        sourcePlatform: incoming?.sourcePlatform,
        fitJobId: result.jobId,
      },
    });
  };

  const tailorThisJob = () => {
    if (!result) return;
    const known = incoming?.company ?? result.report.company;
    // Ask once, here, and never block: Skip is always available below.
    if (!known && employerAsk === null) {
      setEmployerAsk('');
      return;
    }
    goToApply();
  };

  return (
    // The body is overflow:hidden app-wide, so every full-page view owns its
    // own scroll or it simply cannot be scrolled.
    <div style={{
      height: '100dvh', overflowY: 'auto',
      background: C.bgCanvas,
      fontFamily: warm.type.fontBody,
      display: 'flex', flexDirection: 'column',
    }}>
      {gating && (
        <ApplyPreviewGate
          resumeMarkdown={profile?.resumeRawText || profile?.resumeOriginalText || ''}
          role={result?.report.jobTitle}
          company={result?.report.company}
          onClose={() => setGating(false)}
        />
      )}

      <div style={{
        width: '100%', maxWidth: 680, margin: 'auto',
        padding: '48px 24px 64px',
      }}>
        {result ? (
          <>
            <FitReportView
              report={result.report}
              onTailor={tailorThisJob}
              onCheckAnother={checkAnother}
              targetCity={profile?.targetCity}
              saved
            />
            {employerAsk !== null && (
              <EmployerAsk
                value={employerAsk}
                onChange={setEmployerAsk}
                onConfirm={() => goToApply(employerAsk.trim() || undefined)}
                onSkip={() => goToApply()}
              />
            )}
          </>
        ) : checking && incoming ? (
          // Handed a job and already reading it. No paste box: there is nothing
          // for them to do here but wait.
          // Centred as a column, not by text-align: the spinner is an SVG, and
          // whether an inline SVG honours the parent's text-align depends on the
          // reset in play. It was landing hard against the left edge with the
          // copy underneath it centred, which reads as a broken page.
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', padding: '80px 0',
          }}>
            <Loader2 size={28} className="animate-spin" style={{ color: C.accentPetrol }} />
            <p style={{ margin: '18px 0 0', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
              Reading the ad
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: C.textMuted }}>
              Checking it against your resume. About ten seconds.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            <h1 style={{
              margin: '0 0 10px',
              fontSize: 'clamp(24px, 5vw, 34px)', fontWeight: 800,
              letterSpacing: '-0.025em', lineHeight: 1.2, color: C.textPrimary,
            }}>
              See how well your resume fits this job
            </h1>
            {/*
              Two sentences doing two different jobs. The first states the
              premise the whole product rests on and is the only place in the
              app that says it out loud; the second says what this screen does
              about it. Only the premise is bolded, because bolding both leaves nothing
              emphasised.

              The ten seconds is the same figure the reading state already
              claims below, so the two must move together if it is ever retimed.
            */}
            <p style={{ margin: '0 0 28px', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>
              <strong style={{ color: C.textPrimary, fontWeight: 700 }}>
                The simplest and fastest way to land a job is to send out a high volume of high
                quality applications
              </strong>{' '}
              to jobs that match your profile. We read the ad against the resume you gave us and
              tell you whether it is worth your time, in about ten seconds.
            </p>

            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste ANY Job Description here"
              disabled={checking}
              rows={12}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: 18,
                background: C.bgSurface,
                border: `1px solid ${C.borderDefined}`,
                borderRadius: warm.radius.input,
                fontSize: 15, lineHeight: 1.6, color: C.textPrimary,
                fontFamily: 'inherit', resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.accentPetrol; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.borderDefined; }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCheck}
                disabled={!canSubmit}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '14px 28px',
                  background: canSubmit ? C.accentPetrol : C.borderDefined,
                  color: C.textOnDeep, border: 'none',
                  borderRadius: warm.radius.button,
                  fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit
                    ? '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)'
                    : 'none',
                }}
              >
                {checking
                  ? <><Loader2 size={17} className="animate-spin" /> Reading the ad</>
                  : <>Find out <ArrowRight size={17} /></>}
              </button>

              {/* Says what is missing, rather than leaving a dead button. */}
              {!checking && !canSubmit && trimmed.length > 0 && (
                <span style={{ fontSize: 13, color: C.textMuted }}>
                  Paste a bit more of the ad, or the Seek link.
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── EmployerAsk ─────────────────────────────────────────────────────────────

/**
 * Asked only when the ad genuinely never named an employer.
 *
 * Saying nothing is what produced hundreds of tracker rows with no company and
 * follow-up emails addressed to nobody. It asks, it never blocks: Skip sits
 * right there, because nothing is worth standing between someone and an
 * application.
 */
function EmployerAsk({ value, onChange, onConfirm, onSkip }: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        marginTop: 20, padding: '16px 18px', borderRadius: warm.radius.card,
        background: C.bgAlt, border: `1px solid ${C.accentGold}`,
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
        Who is the employer?
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, color: C.textSecondary }}>
        This ad never names one, and without it we cannot write you a follow-up in seven days.
        Type it in, or skip and add it later from your tracker.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onConfirm(); }}
          placeholder="Company name"
          style={{
            flex: '1 1 200px', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
            color: C.textPrimary, background: C.bgSurface,
            border: `1px solid ${C.borderDefined}`, borderRadius: 9, outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onConfirm}
          disabled={!value.trim()}
          style={{
            padding: '10px 18px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            color: C.textOnDeep, background: C.accentPetrol, border: 'none', borderRadius: 9,
            cursor: value.trim() ? 'pointer' : 'not-allowed',
            opacity: value.trim() ? 1 : 0.5,
          }}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            padding: '10px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            color: C.textMuted, background: 'none',
            border: `1px solid ${C.borderDefined}`, borderRadius: 9, cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </motion.div>
  );
}
