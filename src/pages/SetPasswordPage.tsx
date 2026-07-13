import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';
import { PrimaryButton } from '../components/shared/PrimaryButton';
import { Card } from '../components/shared/Card';

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
      // This page is only reached via the paid-client email link, so send them
      // into the paid-client onboarding at /welcome (upload resume, read, roles).
      toast.success('Password set. Welcome in.');
      navigate('/welcome', { replace: true });
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
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, background: warm.colors.bgCanvas,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420 }}
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
            Set your password
          </h1>
          <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: 0 }}>
            Choose a password to finish setting up your account
          </p>
        </div>

        <Card padding="32px" style={{ boxShadow: warm.shadow.lifted }}>
          {linkInvalid ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
                This set-password link has expired or already been used. Head to the
                sign-in page and use "forgot password" to get a fresh one.
              </p>
              <PrimaryButton label="Go to sign in" onClick={() => navigate('/auth', { replace: true })} />
            </div>
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
