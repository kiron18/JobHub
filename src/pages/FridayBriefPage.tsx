import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';

interface BriefData {
  window: { from: string; to: string };
  reportCount: number;
  cached: boolean;
  script: string | null;
  generatedAt?: string;
}

export function FridayBriefPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<BriefData>({
    queryKey: ['friday-brief'],
    queryFn: async () => {
      const { data } = await api.get('/admin/friday-brief');
      return data;
    },
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/friday-brief/generate', {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friday-brief'] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/friday-brief/email', {});
      return data;
    },
    onSuccess: (res) => {
      toast.success(`Brief sent to ${res.sentTo}`);
    },
    onError: () => {
      toast.error('Failed to send email — check RESEND_API_KEY in Railway.');
    },
  });

  function handleCopy() {
    if (!data?.script) return;
    navigator.clipboard.writeText(data.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const windowLabel = data
    ? `${new Date(data.window.from).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} → ${new Date(data.window.to).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : '';

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, marginBottom: 6, color: warm.colors.textPrimary }}>
          Friday Brief
        </h1>
        <p style={{ fontSize: 14, color: warm.colors.textSecondary }}>
          Weekly call script generated from first-time diagnostic reports.
          {windowLabel && ` Current window: ${windowLabel}.`}
        </p>
      </div>

      {isLoading && (
        <div style={{ color: warm.colors.textMuted, fontSize: 14 }}>Loading...</div>
      )}

      {!isLoading && data && (
        <>
          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 28,
            padding: '16px 20px',
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: warm.colors.textMuted }}>Reports this week</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: warm.colors.textPrimary }}>{data.reportCount}</p>
            </div>
            {data.cached && data.generatedAt && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: warm.colors.textMuted }}>Generated</p>
                <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary }}>
                  {new Date(data.generatedAt).toLocaleString('en-AU')}
                </p>
              </div>
            )}
          </div>

          {/* Script or generate button */}
          {data.script ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
                    color: copied ? warm.colors.success : warm.colors.textSecondary,
                    borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy script'}
                </button>
                <button
                  onClick={() => emailMutation.mutate()}
                  disabled={emailMutation.isPending}
                  style={{
                    background: emailMutation.isPending ? `${warm.colors.accentPetrol}80` : warm.colors.accentPetrol,
                    border: 'none',
                    color: warm.colors.textOnDeep, borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: emailMutation.isPending ? 'default' : 'pointer',
                  }}
                >
                  {emailMutation.isPending ? 'Sending...' : '✉ Email to kiron@aussiegradcareers.com.au'}
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: 'none', border: `1px solid ${warm.colors.borderWhisper}`,
                    color: warm.colors.textMuted, borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: generateMutation.isPending ? 'default' : 'pointer',
                  }}
                >
                  {generateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
              <div style={{
                background: warm.colors.bgAlt,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 16, padding: '28px 32px',
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                fontSize: 15, lineHeight: 1.8, color: warm.colors.textSecondary,
              }}>
                {data.script}
              </div>
            </>
          ) : (
            <div style={{
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: 16, padding: '40px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: warm.colors.textSecondary, marginBottom: 24 }}>
                {data.reportCount === 0
                  ? 'No first-time reports in this window yet.'
                  : `${data.reportCount} report${data.reportCount === 1 ? '' : 's'} ready. Generate the call script when you're ready.`}
              </p>
              {data.reportCount > 0 && (
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: warm.colors.accentPetrol,
                    color: warm.colors.textOnDeep, border: 'none', borderRadius: 12,
                    padding: '14px 32px', fontSize: 15, fontWeight: 800,
                    cursor: generateMutation.isPending ? 'default' : 'pointer',
                    opacity: generateMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Friday brief →'}
                </button>
              )}
              {generateMutation.isError && (
                <p style={{ fontSize: 13, color: warm.colors.danger, marginTop: 16 }}>
                  Generation failed — check the server logs.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
