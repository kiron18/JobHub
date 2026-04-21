import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

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
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Friday Brief</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Weekly call script generated from first-time diagnostic reports.
          {windowLabel && ` Current window: ${windowLabel}.`}
        </p>
      </div>

      {isLoading && (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading...</div>
      )}

      {!isLoading && data && (
        <>
          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 28,
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>Reports this week</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{data.reportCount}</p>
            </div>
            {data.cached && data.generatedAt && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>Generated</p>
                <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
                  {new Date(data.generatedAt).toLocaleString('en-AU')}
                </p>
              </div>
            )}
          </div>

          {/* Script or generate button */}
          {data.script ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: copied ? '#34d399' : '#9ca3af', borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy script'}
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#6b7280', borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 600, cursor: generateMutation.isPending ? 'default' : 'pointer',
                  }}
                >
                  {generateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '28px 32px',
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                fontSize: 15, lineHeight: 1.8, color: '#d1d5db',
              }}>
                {data.script}
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '40px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
                {data.reportCount === 0
                  ? 'No first-time reports in this window yet.'
                  : `${data.reportCount} report${data.reportCount === 1 ? '' : 's'} ready. Generate the call script when you're ready.`}
              </p>
              {data.reportCount > 0 && (
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '14px 32px', fontSize: 15, fontWeight: 800,
                    cursor: generateMutation.isPending ? 'default' : 'pointer',
                    opacity: generateMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Friday brief →'}
                </button>
              )}
              {generateMutation.isError && (
                <p style={{ fontSize: 13, color: '#ef4444', marginTop: 16 }}>
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
