import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, ArrowRight, Loader2, CheckCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const hintEmail = searchParams.get('email') ?? '';

  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState(hintEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user]);

  // Auto-send magic link when arriving from ProtectedRoute redirect
  useEffect(() => {
    if (hintEmail) sendMagicLink(hintEmail);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMagicLink(target: string) {
    const t = target.trim();
    if (!t) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: t,
        options: { shouldCreateUser: false },
      });
      if (error) {
        // No account yet — create one via OTP
        const { error: e2 } = await supabase.auth.signInWithOtp({ email: t });
        if (e2) throw e2;
      }
      setMagicSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not send login link');
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!isSignup) navigate('/', { replace: true });
      else toast.success('Check your email to confirm your account');
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, fontSize: 15, color: '#f1f5f9', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
    background: disabled ? 'rgba(99,102,241,0.3)' : '#6366f1',
    color: 'white', fontSize: 15, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.12) 0%, #020617 60%)',
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
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
          }}>
            <Mail size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            {hintEmail ? 'Welcome back' : 'Sign in to JobHub'}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {hintEmail
              ? `Sending a login link to ${hintEmail}`
              : 'Enter your email to continue'}
          </p>
        </div>

        <div style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)',
        }}>
          {/* Mode tabs */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.04)',
            borderRadius: 10, padding: 3, marginBottom: 28, gap: 3,
          }}>
            {(['magic', 'password'] as const).map(m => (
              <button key={m}
                onClick={() => { setMode(m); setMagicSent(false); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: mode === m ? 'rgba(99,102,241,0.22)' : 'transparent',
                  color: mode === m ? '#a5b4fc' : '#475569',
                  transition: 'all 0.15s',
                }}>
                {m === 'magic' ? 'Magic link' : 'Password'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {mode === 'magic' && (
              <motion.div key="magic"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                {magicSent ? (
                  <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                    <CheckCircle size={40} color="#34d399" style={{ marginBottom: 16 }} />
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                      Check your email
                    </p>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
                      We sent a login link to{' '}
                      <strong style={{ color: '#94a3b8' }}>{email || hintEmail}</strong>.
                      Click it and you'll land straight on your dashboard — no password needed.
                    </p>
                    <button onClick={() => sendMagicLink(email || hintEmail)}
                      style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Resend link
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <label style={labelStyle}>Email</label>
                      <input type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMagicLink(email)}
                        placeholder="you@example.com"
                        style={inputStyle} />
                    </div>
                    <button onClick={() => sendMagicLink(email)}
                      disabled={loading || !email.trim()}
                      style={primaryBtn(loading || !email.trim())}>
                      {loading
                        ? <Loader2 size={18} className="animate-spin" />
                        : <><Mail size={16} />Send login link</>}
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {mode === 'password' && (
              <motion.div key="password"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                <form onSubmit={handlePassword}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required style={inputStyle} />
                  </div>
                  <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                    {loading
                      ? <Loader2 size={18} className="animate-spin" />
                      : <><Lock size={16} />{isSignup ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></>}
                  </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#475569' }}>
                  {isSignup ? 'Already have an account?' : "Don't have a password yet?"}
                  {' '}
                  <button onClick={() => setIsSignup(s => !s)}
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    {isSignup ? 'Sign in' : 'Sign up'}
                  </button>
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#334155' }}>
          New user?{' '}
          <button
            onClick={() => {
              localStorage.removeItem('jobhub_auth_email');
              localStorage.removeItem('jobhub_report_seen');
              navigate('/');
            }}
            style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Start fresh →
          </button>
        </p>
      </motion.div>
    </div>
  );
};
