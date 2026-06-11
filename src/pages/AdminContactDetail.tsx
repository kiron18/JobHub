import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, Clock, Eye, MousePointer, Tag, Send, Mail } from 'lucide-react';
import api from '../lib/api';

export default function AdminContactDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [noteContent, setNoteContent] = useState('');

  const { data: contact, isLoading } = useQuery({
    queryKey: ['admin-contact', id],
    queryFn: () => api.get(`/admin/contacts/${id}`).then(r => r.data),
  });

  const { data: allTags } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => api.get('/admin/tags').then(r => r.data),
  });

  const addTag = useMutation({
    mutationFn: (tagId: string) => api.post(`/admin/contacts/${id}/tags`, { tagId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contact'] }); toast.success('Tag added'); },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) => api.delete(`/admin/contacts/${id}/tags/${tagId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-contact'] }); toast.success('Tag removed'); },
  });

  const addNote = useMutation({
    mutationFn: (content: string) => api.post(`/admin/contacts/${id}/notes`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact'] });
      setNoteContent('');
      toast.success('Note added');
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (!contact) return <p>Contact not found</p>;

  const contactTags = contact.tags?.map((ct: any) => ct.tag || ct) ?? [];
  const availableTags = allTags?.filter((t: any) => !contactTags.some((ct: any) => ct.id === t.id)) ?? [];

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Link to="/admin/contacts" style={{ color: '#2d5a6e', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to contacts
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{contact.email}</h1>
      <p style={{ color: '#888', margin: '0 0 20px', fontSize: 14 }}>
        {contact.firstName || contact.lastName ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}` : 'No name'} · {contact.source} · Created {new Date(contact.createdAt).toLocaleDateString()}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column */}
        <div>
          {/* Tags */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={16} /> Tags</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {contactTags.map((tag: any) => (
                <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e8edf0', padding: '4px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#2d5a6e' }}>
                  {tag.label || tag.name}
                  <button onClick={() => removeTag.mutate(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888', fontSize: 14, lineHeight: 1 }}><X size={14} /></button>
                </span>
              ))}
            </div>
            {availableTags.length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) addTag.mutate(e.target.value); }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
              >
                <option value="">+ Add tag...</option>
                {availableTags.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.label || t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Sequence enrollment */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Send size={16} /> Sequences</h3>
            {contact.sequences?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contact.sequences.map((cs: any) => (
                  <div key={cs.id} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eee' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cs.sequence?.name || 'Unknown'}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Step {cs.currentStep} · {cs.completed ? 'Completed' : 'Active'} · Enrolled {new Date(cs.enrolledAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: '#888' }}>Not enrolled in any sequences</p>}
          </div>

          {/* Email history */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={16} /> Email History</h3>
            {contact.emailSends?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contact.emailSends.map((send: any) => (
                  <div key={send.id} style={{ background: '#fff', borderRadius: 8, padding: 10, border: '1px solid #eee', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{send.subject}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {new Date(send.sentAt).toLocaleString()} · {send.sequence?.name || 'Broadcast'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                      <span><Eye size={12} style={{ verticalAlign: 'middle' }} /> {send.opens?.length || 0} opens</span>
                      <span><MousePointer size={12} style={{ verticalAlign: 'middle' }} /> {send.clicks?.length || 0} clicks</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: '#888' }}>No emails sent yet</p>}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Notes timeline */}
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> Notes</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }}
              />
              <button
                onClick={() => { if (noteContent.trim()) addNote.mutate(noteContent.trim()); }}
                disabled={addNote.isPending}
                style={{ padding: '8px 12px', background: '#2d5a6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, alignSelf: 'flex-end' }}
              >
                <Plus size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {contact.notes?.map((n: any) => (
                <div key={n.id} style={{ background: '#fff', borderRadius: 8, padding: 10, border: '1px solid #eee' }}>
                  <p style={{ margin: 0, fontSize: 13 }}>{n.content}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888' }}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {(!contact.notes || contact.notes.length === 0) && <p style={{ fontSize: 13, color: '#888' }}>No notes yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
