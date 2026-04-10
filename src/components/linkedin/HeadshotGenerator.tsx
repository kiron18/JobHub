import React, { useRef, useState } from 'react';
import { Upload, Loader2, Save, RefreshCw, Camera } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';

interface Props {
  initialHeadshotUrl?: string | null;
  onSaved: (url: string) => void;
}

export const HeadshotGenerator: React.FC<Props> = ({ initialHeadshotUrl, onSaved }) => {
  const { T } = useAppTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<{ usedToday: number; limit: number } | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Photo must be under 10 MB');
      return;
    }
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error('Only JPG, PNG, and WebP files are accepted');
      return;
    }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleGenerate() {
    if (!file || generating) return;
    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/linkedin/headshot', formData);
      setResult(data.imageUrl);
      setUsage({ usedToday: data.usedToday, limit: data.limit });
      toast.success('Headshot generated');
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error(`Daily limit reached (${err.response.data.limit}/day). Try again tomorrow.`);
      } else {
        toast.error('Generation failed — try again.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result || saving) return;
    setSaving(true);
    try {
      await api.post('/linkedin/headshot/save', { imageUrl: result });
      onSaved(result);
      toast.success('Headshot saved to profile');
    } catch {
      toast.error('Failed to save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const savedHeadshot = result ?? initialHeadshotUrl;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={14} color="#0A66C2" />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint }}>
            AI Headshot
          </span>
        </div>
        {usage && (
          <span style={{ fontSize: 11, fontWeight: 600, color: usage.usedToday >= usage.limit ? '#f87171' : T.textFaint }}>
            {usage.usedToday} / {usage.limit} today
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photo"
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            width: 140, height: 140, borderRadius: 12, flexShrink: 0,
            border: `2px dashed ${preview ? T.cardBorder : 'rgba(10,102,194,0.4)'}`,
            background: preview ? 'transparent' : 'rgba(10,102,194,0.05)',
            cursor: 'pointer', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {preview
            ? <img src={preview} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <Upload size={24} color="#0A66C2" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, margin: 0 }}>Upload photo</p>
                <p style={{ fontSize: 11, color: T.textFaint, margin: '4px 0 0' }}>JPG, PNG, WebP</p>
              </div>
            )
          }
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        {/* Result */}
        <div style={{ flex: 1 }}>
          {savedHeadshot ? (
            <div style={{ position: 'relative', width: 140, height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <img src={savedHeadshot} alt="Generated headshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: 140, height: 140, borderRadius: 12, marginBottom: 12,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: 12 }}>
                Generated headshot will appear here
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={!file || generating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 8, border: 'none',
                background: !file || generating ? 'rgba(10,102,194,0.3)' : '#0A66C2',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: !file || generating ? 'default' : 'pointer',
              }}
            >
              {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
              {generating ? 'Generating\u2026' : result ? 'Try Again' : 'Generate'}
            </button>
            {result && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, border: `1px solid ${T.cardBorder}`,
                  background: 'transparent', color: '#34d399', fontWeight: 700, fontSize: 13,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                <Save size={13} />
                {saving ? 'Saving\u2026' : 'Save to Profile'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 10, lineHeight: 1.5 }}>
            Studio background · professional lighting · DSLR realism
          </p>
        </div>
      </div>
    </div>
  );
};
