import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Lock, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';
import { PrimaryButton } from '../components/shared/PrimaryButton';
import { Card } from '../components/shared/Card';
import api from '../lib/api';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  // Prefill the email when we arrive carrying it (e.g. from the CV-scan funnel or
  // a returning-user redirect), so the user doesn't retype what we already have.
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(() => searchParams.get('intent') === 'signup');
  const { user, signOut } = useAuth();

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Email a fresh set-password link. Same endpoint the expired-link screen uses.
   * Reuses whatever is already typed in the email field rather than opening a
   * separate screen, so recovery is one click from where they got stuck.
   */
  async function handleForgotPassword() {
    const target = email.trim();
    if (!target || !target.includes('@')) {
      toast.error('Enter your email above first, then tap this again.');
      return;
    }
    setSendingReset(true);
    try {
      const { data } = await api.post('/auth/resend-password-link', { email: target });
      toast.success(data?.message ?? 'Check your inbox.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not send the link. Try again shortly.');
    } finally {
      setSendingReset(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderDefined}`,
    borderRadius: warm.radius.input, fontSize: 15,
    color: warm.colors.textPrimary, outline: 'none',
    fontFamily: warm.type.fontBody,
    transition: 'border-color 200ms, box-shadow 200ms',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: warm.colors.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  return (
    <div style={{
      height: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: warm.colors.bgCanvas,
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
            fontSize: 26, fontWeight: 600,
            color: warm.colors.textPrimary,
            margin: '0 0 8px', letterSpacing: '-0.02em',
            fontFamily: warm.type.fontBody,
          }}>
            Sign in to JobHub
          </h1>
          <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: 0 }}>
            {isSignup ? 'Create a new account' : 'Welcome back'}
          </p>
        </div>

        {/* Already signed in panel */}
        {user && (
          <Card padding="20px" style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${warm.colors.accentPetrol}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={16} color={warm.colors.accentPetrol} />
                </div>
                <div>
                  <p style={{
                    fontSize: 11, color: warm.colors.textMuted,
                    fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', margin: 0,
                  }}>
                    Signed in as
                  </p>
                  <p style={{ fontSize: 13, color: warm.colors.textSecondary, margin: 0 }}>
                    {user.email}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryButton
                  label="Go to app"
                  onClick={() => navigate('/', { replace: true })}
                  small
                />
                <button
                  onClick={async () => { await signOut(); }}
                  style={{
                    padding: '7px 12px', borderRadius: warm.radius.button,
                    border: `1px solid ${warm.colors.borderDefined}`,
                    background: 'transparent',
                    color: warm.colors.textSecondary,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: warm.type.fontBody,
                  }}
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          </Card>
        )}

        <Card padding="32px" style={{ boxShadow: warm.shadow.lifted }}>
          <AnimatePresence mode="wait">
            <motion.div key="password"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <form onSubmit={handlePassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    style={inputStyle}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = warm.colors.accentPetrol;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.ringFocus}, 0 0 0 1px ${warm.colors.accentPetrol}`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = warm.colors.borderDefined;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    style={inputStyle}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = warm.colors.accentPetrol;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.ringFocus}, 0 0 0 1px ${warm.colors.accentPetrol}`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = warm.colors.borderDefined;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  {!isSignup && (
                    <div style={{ textAlign: 'right', marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={sendingReset}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: warm.colors.accentPetrol,
                          fontWeight: 600, fontSize: 12.5,
                          cursor: sendingReset ? 'default' : 'pointer',
                          opacity: sendingReset ? 0.6 : 1,
                          fontFamily: warm.type.fontBody,
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        {sendingReset ? 'Sending…' : 'Forgot password?'}
                      </button>
                    </div>
                  )}
                </div>
                <PrimaryButton
                  label={loading ? '' : (isSignup ? 'Create account' : 'Sign in')}
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
              <p style={{
                textAlign: 'center', marginTop: 20, fontSize: 13,
                color: warm.colors.textSecondary,
              }}>
                {isSignup ? 'Already have an account?' : "Don't have an account yet?"}
                {' '}
                <button onClick={() => setIsSignup(s => !s)}
                  style={{
                    background: 'none', border: 'none',
                    color: warm.colors.accentPetrol,
                    fontWeight: 600, cursor: 'pointer', fontSize: 13,
                    fontFamily: warm.type.fontBody,
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                  {isSignup ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>
        </Card>

        <p style={{
          textAlign: 'center', marginTop: 24, fontSize: 13,
          color: warm.colors.textMuted,
        }}>
          New user?{' '}
          <button
            onClick={() => {
              localStorage.removeItem('jobhub_auth_email');
              localStorage.removeItem('jobhub_report_seen');
              navigate('/');
            }}
            style={{
              background: 'none', border: 'none',
              color: warm.colors.accentPetrol,
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
              fontFamily: warm.type.fontBody,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
            Start fresh →
          </button>
        </p>
      </motion.div>
    </div>
  );
};
