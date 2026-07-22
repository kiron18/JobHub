import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';
import { PrimaryButton } from '../components/shared/PrimaryButton';
import { Card } from '../components/shared/Card';
import api from '../lib/api';

/**
 * Landing page for the set-password link emailed after payment.
 *
 * The recovery link carries the session in the URL hash; supabase-js has
 * detectSessionInUrl enabled, so it establishes the session automatically and
 * fires PASSWORD_RECOVERY. We wait for a session to exist, then let the buyer
 * choose a password via updateUser, and drop them into the app.
 */
export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // `?flow=reset` marks a link from "forgot password" / a resend rather than the
  // post-payment welcome email. Same page, but a returning user should land back
  // in the app instead of being walked through onboarding again.
  const isReset = new URLSearchParams(window.location.search).get('flow') === 'reset';

  useEffect(() => {
    let settled = false;
    const markReady = () => { if (!settled) { settled = true; setReady(true); } };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') markReady();
    });

    // Two ways the recovery session can arrive:
    //  1. Hash fragment (#access_token=…&type=recovery) — the default when the
    //     emailed action_link redirects here. supabase-js processes it via
    //     detectSessionInUrl and fires PASSWORD_RECOVERY.
    //  2. Query param (?token_hash=…&type=recovery) — when the link carries a
    //     hashed token we must exchange ourselves with verifyOtp.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (tokenHash && type) {
      // Explicit token exchange. Its promise fully decides the outcome, so we do
      // NOT arm a stale-link timer here — a slow first-load compile must never
      // race the exchange and flip us to "expired" prematurely.
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: type as any })
        .then(({ data, error }) => {
          if (error || !data.session) setLinkInvalid(true);
          else markReady();
        })
        .catch(() => setLinkInvalid(true));
    } else {
      // Hash-fragment path: supabase-js processes the URL and fires an event.
      // Only here do we need a fallback timer for a genuinely stale link.
      timer = setTimeout(() => { if (!settled) setLinkInvalid(true); }, 8000);
    }

    // Session may already be established by the time we mount (hash processed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    return () => { subscription.unsubscribe(); if (timer) clearTimeout(timer); };
  }, []);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-password-link', { email: resendEmail });
      toast.success(data?.message ?? 'Check your inbox.');
      setResent(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not send the link. Try again shortly.');
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // A reset is a returning user, so drop them in the app. The welcome-email
      // path is a fresh buyer, so send them to paid-client onboarding at
      // /welcome (upload resume, read, roles).
      toast.success(isReset ? 'Password updated.' : 'Password set. Welcome in.');
      navigate(isReset ? '/' : '/welcome', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Could not set your password.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderDefined}`,
    borderRadius: warm.radius.input, fontSize: 15,
    color: warm.colors.textPrimary, outline: 'none',
    fontFamily: warm.type.fontBody,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: warm.colors.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  return (
    <div style={{
      height: '100dvh', overflowY: 'auto', display: 'flex',
      padding: 24, background: warm.colors.bgCanvas, boxSizing: 'border-box',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420, margin: 'auto' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16, marginBottom: 20,
            background: warm.colors.accentPetrol,
            boxShadow: `0 8px 32px ${warm.colors.accentPetrol}40`,
          }}>
            <Lock size={24} color={warm.colors.bgCanvas} />
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 600, color: warm.colors.textPrimary,
            margin: '0 0 8px', letterSpacing: '-0.02em', fontFamily: warm.type.fontBody,
          }}>
            {isReset ? 'Choose a new password' : 'Set your password'}
          </h1>
          <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: 0 }}>
            {isReset
              ? 'Pick a new password and we\'ll sign you straight in'
              : 'Choose a password to finish setting up your account'}
          </p>
        </div>

        <Card padding="32px" style={{ boxShadow: warm.shadow.lifted }}>
          {linkInvalid ? (
            resent ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
                  If that email has an account, a new link is on its way. It's good for
                  one use, so open it as soon as you can.
                </p>
                <PrimaryButton label="Go to sign in" onClick={() => navigate('/auth', { replace: true })} />
              </div>
            ) : (
              <form onSubmit={handleResend}>
                <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
                  This link has expired or has already been used. Links are single use,
                  so enter your email and we'll send a fresh one. Your account and access
                  are unaffected.
                </p>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus style={inputStyle}
                  />
                </div>
                <PrimaryButton
                  label={resending ? '' : 'Email me a new link'}
                  onClick={() => {}}
                  disabled={resending}
                  type="submit"
                />
                {resending && (
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                  </div>
                )}
              </form>
            )
          ) : !ready ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
              <p style={{ fontSize: 13, color: warm.colors.textMuted, marginTop: 12 }}>
                Verifying your link…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>New password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" required autoFocus style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirm password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password" required style={inputStyle}
                />
              </div>
              <PrimaryButton
                label={loading ? '' : 'Set password & continue'}
                onClick={() => {}}
                disabled={loading}
                type="submit"
              />
              {loading && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
              )}
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
};
