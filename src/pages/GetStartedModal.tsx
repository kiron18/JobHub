/**
 * GetStartedModal — account-creation + job-scrape funnel.
 *
 * Builds on MockLandingPage's design tokens (colors / typeTokens).
 * Renders as a full-screen portal overlay matching ScanReveal's surface.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { colors, type as typeTokens } from '../components/landing/tokens';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { getStartedCopy } from './getStartedCopy';

const EASE = [0.25, 1, 0.5, 1] as const;

// De-dupe the job-titles fetch across mounts. React 18 StrictMode double-mounts
// effects in dev, which otherwise fires /job-titles (and its server-side scrape)
// twice with two different LLM title sets, leaving the displayed roles out of sync
// with the roles actually scraped. Both mounts now share one in-flight request.
const jobTitlesInFlight = new Map<string, Promise<{ titles: string[]; location: string }>>();

function fetchJobTitlesOnce(scanId: string) {
  let p = jobTitlesInFlight.get(scanId);
  if (!p) {
    p = api.post('/cv-scan/job-titles', { scanId })
      .then(resp => ({
        titles: (resp.data.titles || []).slice(0, 3),
        location: resp.data.location || 'All Australia',
      }))
      .catch(err => { jobTitlesInFlight.delete(scanId); throw err; });
    jobTitlesInFlight.set(scanId, p);
  }
  return p;
}

interface GetStartedModalProps {
  scanId: string;
  firstName?: string;
  email: string;
  onClose: () => void;
}

export function GetStartedModal({ scanId, firstName, email, onClose }: GetStartedModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [titles, setTitles] = useState<string[]>([]);
  const [location, setLocation] = useState('All Australia');
  const [titlesLoading, setTitlesLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [buildStepIdx, setBuildStepIdx] = useState(0);
  const [addingRole, setAddingRole] = useState(false);
  const [newRole, setNewRole] = useState('');

  // Whether we've already created an account and need a retry on claim only.
  const [accountCreated, setAccountCreated] = useState(false);

  // ── On mount: fetch suggested job titles from the scan ────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { titles, location } = await fetchJobTitlesOnce(scanId);
        if (cancelled) return;
        setTitles(titles);
        setLocation(location);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setExpired(true);
        }
        // Other errors keep the user on screen — they can still type password.
        // Roles will be empty, but the scrape will fall back.
      } finally {
        if (!cancelled) setTitlesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scanId]);

  // Role/location edits update local state only. The actual job scrape is owned by
  // the dashboard feed build (GET /api/job-feed/feed), fired once after claim with
  // the final location — so editing here must NOT trigger any scrape.

  const onEditTitles = useCallback((newTitles: string[]) => {
    setTitles(newTitles);
  }, []);

  const onEditLocation = useCallback((newLocation: string) => {
    setLocation(newLocation);
  }, []);

  // Cycle the reassurance copy while the workspace is being built (~20s scrape).
  useEffect(() => {
    if (!submitting) { setBuildStepIdx(0); return; }
    const id = setInterval(() => {
      setBuildStepIdx(i => Math.min(i + 1, getStartedCopy.buildingSteps.length - 1));
    }, 4000);
    return () => clearInterval(id);
  }, [submitting]);

  // ── Submit: create account → claim workspace ─────────────────────────────

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError(getStartedCopy.errPasswordShort);
      return;
    }
    setSubmitting(true);
    setError(null);

    // Step 1: Create the account (skip if we already created it on a prior attempt)
    if (!accountCreated) {
      const { error: signErr } = await supabase.auth.signUp({ email, password });
      if (signErr) {
        setError(getStartedCopy.errSignup);
        setSubmitting(false);
        return;
      }
      setAccountCreated(true);
    }

    // Step 1b: Ensure a session exists before claiming. signUp auto-signs in when
    // email confirmation is off, but may not when it's on (staging). Explicitly
    // signing in guarantees a valid token regardless of Supabase project settings.
    const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !session) {
      setError(getStartedCopy.errSignup);
      setSubmitting(false);
      return;
    }

    // Step 2: Claim the workspace
    try {
      await api.post('/cv-scan/claim', { scanId, titles, location });
      localStorage.setItem('jobhub_auth_email', email);
      localStorage.setItem('jobhub_report_seen', 'true');
      // Optimistically seed the profile cache as onboarding-complete so the
      // dashboard gate never flashes the onboarding form while the fresh profile
      // loads. The invalidate then refetches the full profile in the background
      // (the cache keeps showing the complete value during the refetch).
      queryClient.setQueryData(['profile'], (old: any) => ({
        ...(old ?? {}),
        hasCompletedOnboarding: true,
        email,
        targetRole: titles[0] ?? old?.targetRole ?? null,
        targetCity: location ?? old?.targetCity ?? null,
        location: location ?? old?.location ?? null,
      }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      navigate('/');
    } catch {
      setError(getStartedCopy.errClaim);
      setSubmitting(false);
      // account exists — user can retry to hit claim again
    }
  };

  // ── Add / remove role chips ──────────────────────────────────────────────

  const removeTitle = (idx: number) => {
    onEditTitles(titles.filter((_, i) => i !== idx));
  };

  const commitRole = () => {
    const r = newRole.trim();
    if (r && titles.length < 3) onEditTitles([...titles, r]);
    setNewRole('');
    setAddingRole(false);
  };

  // ── Expired state ────────────────────────────────────────────────────────

  if (expired) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: colors.bgCanvas,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{
            background: colors.bgSurface,
            borderRadius: 20,
            padding: '40px 32px',
            maxWidth: 420,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(26,24,20,0.04), 0 12px 36px rgba(26,24,20,0.07)',
          }}
        >
          <h2 style={{
            fontFamily: typeTokens.display, fontSize: 24, fontWeight: 600,
            color: colors.textPrimary, margin: 0,
          }}>
            {getStartedCopy.expiredTitle}
          </h2>
          <p style={{
            fontFamily: typeTokens.body, fontSize: 15, lineHeight: 1.6,
            color: colors.textSecondary, margin: '12px 0 24px',
          }}>
            {getStartedCopy.expiredBody}
          </p>
          <button onClick={onClose} style={{
            fontFamily: typeTokens.body, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', padding: '12px 24px', borderRadius: 12,
            border: 'none', background: colors.accentPetrol, color: colors.textOnDeep,
          }}>
            Close
          </button>
        </motion.div>
      </motion.div>,
      document.body,
    );
  }

  // ── Main modal ───────────────────────────────────────────────────────────

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: colors.bgCanvas,
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: `radial-gradient(120% 80% at 50% -10%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 55%)`,
        }}
      >
        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '20px 24px' }}>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textMuted, padding: 6,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', minHeight: 0 }}>
          <div style={{ width: '100%', maxWidth: 460 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.42, ease: EASE }}
              >
                {/* Header */}
                <h1 style={{
                  fontFamily: typeTokens.display, fontWeight: 600,
                  letterSpacing: '-0.02em', lineHeight: 1.08,
                  color: colors.textPrimary, fontSize: 'clamp(28px, 4.6vw, 40px)',
                  margin: 0,
                }}>
                  {getStartedCopy.header(firstName || '')}
                </h1>
                <p style={{
                  fontFamily: typeTokens.body, fontSize: 16, lineHeight: 1.6,
                  color: colors.textSecondary, margin: '10px 0 0',
                }}>
                  {getStartedCopy.subhead}
                </p>

                {/* ── Account section ── */}
                <div style={{ marginTop: 28 }}>
                  <span style={{
                    fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted,
                  }}>
                    {getStartedCopy.accountLabel}
                  </span>
                </div>

                {/* Email (read-only) */}
                <div style={{
                  marginTop: 10, padding: '14px 16px',
                  background: colors.bgAlt, borderRadius: 12,
                  border: `1px solid ${colors.borderWhisper}`,
                  fontFamily: typeTokens.body, fontSize: 15, color: colors.textMuted,
                }}>
                  <span style={{ color: colors.textSecondary }}>{getStartedCopy.emailPrefix} </span>
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{email}</span>
                </div>

                {/* Password */}
                <div style={{ marginTop: 14 }}>
                  <span style={{
                    fontFamily: typeTokens.body, fontSize: 12, fontWeight: 600,
                    color: colors.textSecondary,
                  }}>
                    {getStartedCopy.passwordLabel}
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder={getStartedCopy.passwordPlaceholder}
                    onKeyDown={e => { if (e.key === 'Enter' && !submitting) handleSubmit(); }}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box',
                      marginTop: 6, padding: '14px 16px', borderRadius: 12,
                      border: `1px solid ${colors.borderDefined}`,
                      background: colors.bgSurface, color: colors.textPrimary,
                      fontFamily: typeTokens.body, fontSize: 15, outline: 'none',
                    }}
                    autoFocus
                  />
                </div>

                {/* ── Roles section ── */}
                <div style={{ marginTop: 24 }}>
                  <span style={{
                    fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted,
                  }}>
                    {getStartedCopy.rolesLabel}
                  </span>
                  <span style={{
                    fontFamily: typeTokens.body, fontSize: 11, color: colors.textMuted, marginLeft: 8,
                  }}>
                    {getStartedCopy.rolesHint}
                  </span>
                </div>

                {/* Title chips */}
                {titlesLoading ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        height: 36, width: 100, borderRadius: 99,
                        background: colors.bgAlt, overflow: 'hidden', position: 'relative',
                      }}>
                        <motion.div
                          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(45,90,110,0.12), transparent)' }}
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 1.3, ease: 'linear', repeat: Infinity, delay: i * 0.3 }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {titles.map((t, i) => (
                      <span key={i} style={{
                        fontFamily: typeTokens.body, fontSize: 13, fontWeight: 600,
                        padding: '8px 14px', borderRadius: 99,
                        border: `1px solid ${colors.accentPetrol}`,
                        background: 'rgba(45,90,110,0.08)',
                        color: colors.accentPetrol,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        {t}
                        <button
                          onClick={() => removeTitle(i)}
                          aria-label={`Remove ${t}`}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: colors.accentPetrol, padding: 0, display: 'flex',
                            fontSize: 14, lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {titles.length < 3 && (
                      addingRole ? (
                        <input
                          autoFocus
                          value={newRole}
                          onChange={e => setNewRole(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRole(); }
                            if (e.key === 'Escape') { setNewRole(''); setAddingRole(false); }
                          }}
                          onBlur={commitRole}
                          placeholder="Type a role"
                          style={{
                            fontFamily: typeTokens.body, fontSize: 13, fontWeight: 600,
                            padding: '8px 14px', borderRadius: 99,
                            border: `1px solid ${colors.accentPetrol}`,
                            background: colors.bgSurface, color: colors.textPrimary,
                            outline: 'none', width: 150,
                          }}
                        />
                      ) : (
                        <button onClick={() => setAddingRole(true)} style={{
                          fontFamily: typeTokens.body, fontSize: 13, fontWeight: 600,
                          padding: '8px 14px', borderRadius: 99,
                          border: `1px dashed ${colors.borderDefined}`,
                          background: 'transparent', color: colors.textMuted,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          <Plus size={14} />
                          {getStartedCopy.addRole}
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* ── Location section ── */}
                <div style={{ marginTop: 20 }}>
                  <span style={{
                    fontFamily: typeTokens.body, fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMuted,
                  }}>
                    {getStartedCopy.locationLabel}
                  </span>
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={e => onEditLocation(e.target.value)}
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    marginTop: 6, padding: '12px 14px', borderRadius: 12,
                    border: `1px solid ${colors.borderDefined}`,
                    background: colors.bgSurface, color: colors.textPrimary,
                    fontFamily: typeTokens.body, fontSize: 14, outline: 'none',
                  }}
                />
                <p style={{
                  fontFamily: typeTokens.body, fontSize: 11.5, lineHeight: 1.4,
                  color: colors.textMuted, margin: '6px 0 0',
                }}>
                  {getStartedCopy.locationNudge}
                </p>

                {/* ── Submit ── */}
                <div style={{ marginTop: 28 }}>
                  <motion.button
                    onClick={handleSubmit}
                    disabled={submitting}
                    animate={!submitting && password.length >= 8
                      ? { boxShadow: ['0 0 0 0 rgba(45,90,110,0)', '0 0 0 8px rgba(45,90,110,0.14)', '0 0 0 0 rgba(45,90,110,0)'] }
                      : {}}
                    transition={{ duration: 1.8, ease: EASE, repeat: !submitting && password.length >= 8 ? Infinity : 0, repeatDelay: 0.8 }}
                    style={{
                      fontFamily: typeTokens.body, fontSize: 16, fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      padding: '15px 30px', borderRadius: 14, border: 'none',
                      width: '100%', display: 'inline-flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8,
                      background: submitting ? colors.borderDefined : colors.accentPetrol,
                      color: submitting ? colors.textMuted : colors.textOnDeep,
                    }}
                  >
                    {submitting ? (
                      <>{getStartedCopy.submitting} <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></>
                    ) : (
                      <>{getStartedCopy.submit} <ArrowRight size={18} /></>
                    )}
                  </motion.button>

                  {submitting && (
                    <p style={{
                      fontFamily: typeTokens.body, fontSize: 12.5, lineHeight: 1.5,
                      color: colors.textSecondary, margin: '12px 0 0', textAlign: 'center', minHeight: 18,
                    }}>
                      {getStartedCopy.buildingSteps[buildStepIdx]}
                    </p>
                  )}

                  {error && (
                    <p style={{
                      fontFamily: typeTokens.body, fontSize: 12, color: '#C2603F',
                      margin: '10px 0 0', textAlign: 'center',
                    }}>
                      {error}
                    </p>
                  )}

                  <p style={{
                    fontFamily: typeTokens.body, fontSize: 11.5, lineHeight: 1.5,
                    color: colors.textMuted, margin: '14px 0 0', textAlign: 'center',
                  }}>
                    {getStartedCopy.consent}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Spacer for bottom padding ── */}
        <div style={{ minHeight: 24 }} />

        {/* Inline keyframe for the spinner */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default GetStartedModal;
