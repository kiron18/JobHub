import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Save, Eye, MousePointer } from 'lucide-react';
import api from '../lib/api';

export default function AdminBroadcasts() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [targetTag, setTargetTag] = useState('');
  const [preview, setPreview] = useState(false);

  const { data: allTags } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => api.get('/admin/tags').then(r => r.data),
  });

  const { data: broadcasts } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => api.get('/admin/broadcasts').then(r => r.data),
  });

  const saveDraft = useMutation({
    mutationFn: () => api.post('/admin/broadcasts', { name, subject, bodyText, bodyHtml, targetCriteria: { tag: targetTag } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Draft saved'); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save'),
  });

  const sendNow = useMutation({
    mutationFn: () => api.post('/admin/broadcasts', { name, subject, bodyText, bodyHtml, targetCriteria: { tag: targetTag }, sendNow: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Broadcast sending!'); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send'),
  });

  const sendDraft = useMutation({
    mutationFn: (id: string) => api.post(`/admin/broadcasts/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); toast.success('Sending'); },
  });

  function resetForm() { setName(''); setSubject(''); setBodyText(''); setBodyHtml(''); setTargetTag(''); }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        <Send size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Broadcasts
      </h1>

      <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>New Broadcast</h2>

        <div style={{ display: 'grid', gap: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Broadcast name (internal)" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
          <select value={targetTag} onChange={e => setTargetTag(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
            <option value="">Select target tag...</option>
            {allTags?.map((t: any) => <option key={t.id} value={t.name}>{t.label || t.name}</option>)}
          </select>

          <textarea
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            placeholder="Plain text body..."
            rows={6}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
          />
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            placeholder="HTML body (optional)..."
            rows={8}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
          />
        </div>

        {preview && bodyHtml && (
          <div style={{ marginTop: 12, border: '1px solid #ddd', borderRadius: 8, padding: 16, background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>HTML Preview:</div>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPreview(!preview)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {preview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={() => saveDraft.mutate()} disabled={!name || !subject || !targetTag} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={14} /> Save Draft
          </button>
          <button onClick={() => sendNow.mutate()} disabled={!name || !subject || !targetTag || sendNow.isPending} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#2d5a6e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Send size={14} /> Send Now
          </button>
        </div>
      </div>

      {/* Past broadcasts */}
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Past Broadcasts</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Target</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {broadcasts?.map((b: any) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{b.name}</td>
              <td style={{ padding: '8px', fontSize: 13 }}>{b.targetCriteria?.tag || '—'}</td>
              <td style={{ padding: '8px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: b.status === 'sent' ? '#e8f5e9' : b.status === 'draft' ? '#fff8e1' : '#e3f2fd',
                  color: b.status === 'sent' ? '#2e7d32' : b.status === 'draft' ? '#f57f17' : '#1565c0',
                }}>{b.status}</span>
              </td>
              <td style={{ padding: '8px' }}>
                {b.status === 'draft' && (
                  <button onClick={() => sendDraft.mutate(b.id)} style={{ padding: '4px 10px', border: '1px solid #2d5a6e', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#2d5a6e' }}>Send</button>
                )}
              </td>
            </tr>
          ))}
          {(!broadcasts || broadcasts.length === 0) && (
            <tr><td colSpan={4} style={{ padding: '16px', color: '#888', textAlign: 'center' }}>No broadcasts yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
