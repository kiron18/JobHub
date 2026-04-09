import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Loader2, Lock, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

export const AuthPage: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Authenticated users see a panel with "Go to app" and "Sign out" — they are NOT
  // auto-redirected so they can switch accounts if needed.

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

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google sign-in failed');
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
            <Lock size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Sign in to JobHub
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {isSignup ? 'Create a new account' : 'Welcome back'}
          </p>
        </div>

        {/* Already signed in panel */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 20, marginBottom: 20, backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={16} color="#a5b4fc" />
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Signed in as</p>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{user.email}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/', { replace: true })}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Go to app
              </button>
              <button
                onClick={async () => { await signOut(); }}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#64748b',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}

        <div style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)',
        }}>
          {/* Google OAuth button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: '#f1f5f9',
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 8, opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <AnimatePresence mode="wait">
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
                {isSignup ? 'Already have an account?' : "Don't have an account yet?"}
                {' '}
                <button onClick={() => setIsSignup(s => !s)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {isSignup ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </motion.div>
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
