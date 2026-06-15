import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import api from '../lib/api';

export default function AdminContacts() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contacts', search],
    queryFn: () => api.get('/admin/contacts', { params: { search } }).then(r => r.data),
  });

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Contacts
        </h1>
        <Link to="/admin/contacts/new" style={{
          padding: '8px 16px', background: '#2d5a6e', color: '#fff',
          borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14,
        }}>
          + New Contact
        </Link>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#999' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box',
          }}
        />
      </div>

      {isLoading ? (
        <p>Loading contacts...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px' }}>Email</th>
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th style={{ padding: '10px 8px' }}>Tags</th>
              <th style={{ padding: '10px 8px' }}>Active Sequence</th>
              <th style={{ padding: '10px 8px' }}>Last Email</th>
              <th style={{ padding: '10px 8px' }}>Sends</th>
              <th style={{ padding: '10px 8px' }}>Opt-In</th>
            </tr>
          </thead>
          <tbody>
            {data?.contacts?.map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px' }}>
                  <Link to={`/admin/contacts/${c.id}`} style={{ color: '#2d5a6e', textDecoration: 'none' }}>
                    {c.email}
                  </Link>
                </td>
                <td style={{ padding: '10px 8px' }}>{c.firstName || c.lastName ? `${c.firstName ?? ''} ${c.lastName ?? ''}` : '—'}</td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.tags?.map((t: any) => (
                      <span key={t.id} style={{
                        background: '#e8edf0', padding: '2px 8px', borderRadius: 12,
                        fontSize: 12, color: '#2d5a6e', fontWeight: 600,
                      }}>
                        {t.label || t.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13 }}>
                  {c.activeSequence ? `${c.activeSequence.name} (step ${c.activeSequence.currentStep})` : '—'}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#888' }}>
                  {c.lastEmailSent ? new Date(c.lastEmailSent).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>{c.totalSends}</td>
                <td style={{ padding: '10px 8px' }}>
                  {c.emailOptIn ? <span style={{ color: '#2a9d6f' }}>Yes</span> : <span style={{ color: '#c2603f' }}>No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
