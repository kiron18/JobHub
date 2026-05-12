import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, X, Sparkles } from 'lucide-react';
import api from '../lib/api';

interface Props {
  isDark: boolean;
}

type BannerStatus = 'checking' | 'pending' | 'generating' | 'ready' | 'dismissed';

const DISMISSED_KEY = 'jobhub_baseline_resume_dismissed';

export function BaselineResumeBanner({ isDark }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<BannerStatus>('checking');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const check = useCallback(async () => {
    try {
      const { data } = await api.get('/profile/baseline-resume');
      if (data.status === 'ready') {
        setDocumentId(data.documentId);
        setStatus('ready');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('pending');
    }
  }, []);

  // Initial check, skip entirely if already dismissed
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) {
      setStatus('dismissed');
      return;
    }
    check();
  }, [check]);

  // Poll every 3s while pending or generating
  useEffect(() => {
    if (status !== 'pending' && status !== 'generating') return;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get('/profile/baseline-resume');
        if (data.status === 'ready') {
          setDocumentId(data.documentId);
          setStatus('ready');
          clearInterval(id);
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(id);
  }, [status]);

  // If still pending after initial check, trigger on-demand generation
  useEffect(() => {
    if (status !== 'pending') return;
    api.post('/profile/baseline-resume/generate').catch(() => {});
    setStatus('generating');
  }, [status]);

  const handleDownload = async () => {
    if (!documentId || downloading) return;
    setDownloading(true);
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      const { exportDocx } = await import('../lib/exportDocx');
      await exportDocx(data.content, 'resume', '');
      dismiss();
      setShowModal(true);
    } catch {
      // silent, user can retry
    } finally {
      setDownloading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setStatus('dismissed');
  };

  if (status === 'dismissed' || status === 'checking') return null;

  const accent = '#2dd4bf';
  const bg = isDark ? 'rgba(45,212,191,0.06)' : 'rgba(45,212,191,0.08)';
  const border = isDark ? 'rgba(45,212,191,0.2)' : 'rgba(45,212,191,0.3)';
  const text = isDark ? '#f3f4f6' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <>
      {/* Banner */}
      <div style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${accent}18`, border: `1px solid ${accent}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Sparkles size={17} style={{ color: accent }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
              {status === 'ready' ? 'Your improved resume is ready' : 'Preparing your improved resume…'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: sub }}>
              {status === 'ready'
                ? 'Rewritten based on your diagnostic findings, free to download'
                : 'We’re rewriting it based on your diagnostic findings'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {status === 'ready' ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              aria-label="Download your improved resume"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: accent, color: '#0d1117',
                border: 'none', borderRadius: 9, padding: '9px 18px',
                fontSize: 13, fontWeight: 800, cursor: downloading ? 'wait' : 'pointer',
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading
                ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Downloading…</>
                : <><Download size={13} /> Download free resume</>
              }
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: sub, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: accent }} />
              <span>Generating…</span>
            </div>
          )}

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: sub, padding: 4, lineHeight: 1,
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Conversion modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Resume downloaded"
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? '#0d1117' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 20, padding: '32px 36px', maxWidth: 400, width: '100%',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${accent}18`, border: `1px solid ${accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Download size={20} style={{ color: accent }} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
              Your resume is downloading
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: sub, lineHeight: 1.6 }}>
              Want to tailor it to a real job? You have 5 free generations, resumes and cover letters included.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { setShowModal(false); navigate('/'); }}
                style={{
                  background: accent, color: '#0d1117',
                  border: 'none', borderRadius: 10, padding: '12px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', width: '100%',
                }}
              >
                Start matching jobs →
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent', color: sub,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 10, padding: '11px 20px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%',
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
