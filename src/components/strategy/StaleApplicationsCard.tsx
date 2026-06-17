import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Copy, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

interface JobApplicationLite {
  id: string;
  title: string;
  company: string;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
  dateApplied: string | null;
}

const STALE_DAYS = 7;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function generateFollowUpEmail(company: string, days: number): string {
  const templates = [
    `Subject: Following up on my application

Hi [Hiring Manager Name],

I hope this message finds you well. I wanted to follow up on my application for a role at ${company} that I submitted ${days} days ago.

I'm very interested in the opportunity and would welcome the chance to discuss how my skills could contribute to your team. If there's any additional information I can provide to support my application, please let me know.

Thank you for your time and consideration.

Best regards,
[Your Name]`,

    `Subject: Application follow-up

Hello,

I hope you're doing well. I'm writing to follow up on my recent application to ${company}, submitted ${days} days ago.

I remain enthusiastic about the opportunity to join your team and would appreciate any updates you might be able to share regarding the hiring process.

Please don't hesitate to reach out if you need any further information from me.

Kind regards,
[Your Name]`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

interface FollowUpModalProps {
  job: JobApplicationLite;
  days: number;
  onClose: () => void;
}

function FollowUpModal({ job, days, onClose }: FollowUpModalProps) {
  const [copied, setCopied] = useState(false);
  const email = generateFollowUpEmail(job.company, days);

  async function handleCopy() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        style={{
          background: warm.colors.bgSurface,
          borderRadius: 16,
          padding: 24,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: warm.colors.textPrimary }}>
            Follow up on {job.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: warm.colors.textMuted,
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
          You applied to <strong>{job.company}</strong> {days} days ago. Here's a ready-to-send follow-up email.
        </p>

        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: warm.colors.bgAlt,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}>
            <pre style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              color: warm.colors.textPrimary,
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {email}
            </pre>
          </div>

          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              background: warm.colors.accentPetrol,
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy email to clipboard'}
          </button>
        </div>

        <div style={{
          background: 'rgba(45, 90, 110, 0.08)',
          border: `1px solid ${warm.colors.borderWhisper}`,
          borderRadius: 12,
          padding: 16,
        }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: warm.colors.accentPetrol,
          }}>
            How to find the hiring manager's email
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
            Look up the hiring manager or recruiter at {job.company} using these tools, then personalize the email above with their name.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href="https://hunter.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                color: warm.colors.accentPetrol,
                textDecoration: 'none',
              }}
            >
              hunter.io <ExternalLink size={12} />
            </a>
            <span style={{ color: warm.colors.textMuted }}>or</span>
            <a
              href="https://rocketreach.co"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                color: warm.colors.accentPetrol,
                textDecoration: 'none',
              }}
            >
              rocketreach.co <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function StaleApplicationsCard() {
  const [selectedJob, setSelectedJob] = useState<JobApplicationLite | null>(null);

  const { data: jobs } = useQuery<JobApplicationLite[]>({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get('/jobs')).data,
    staleTime: 60 * 1000,
  });

  const stale = (jobs ?? [])
    .filter(j =>
      j.status === 'APPLIED' &&
      (daysSince(j.dateApplied) ?? 0) >= STALE_DAYS
    )
    .sort((a, b) => (daysSince(b.dateApplied) ?? 0) - (daysSince(a.dateApplied) ?? 0))
    .slice(0, 5);

  if (stale.length === 0) return null;

  return (
    <>
      <div style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 16,
        padding: 22,
        boxShadow: warm.shadow.soft,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Clock size={13} style={{ color: warm.colors.accentPetrol }} />
          <p style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: warm.colors.accentPetrol,
            textTransform: 'uppercase',
          }}>
            Follow up:
          </p>
        </div>
        <p style={{
          margin: '0 0 16px',
          fontSize: 13,
          color: warm.colors.textSecondary,
          lineHeight: 1.55,
        }}>
          Jobs you applied to over a week ago. Click follow up to get a pre-written email.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stale.map(job => {
            const days = daysSince(job.dateApplied) ?? 0;
            return (
              <div
                key={job.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${warm.colors.borderWhisper}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: warm.colors.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {job.title}
                  </p>
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: 11,
                    fontWeight: 600,
                    color: warm.colors.textSecondary,
                  }}>
                    {job.company} · sent {days} day{days === 1 ? '' : 's'} ago
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(job)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: `1px solid ${warm.colors.accentPetrol}`,
                    background: warm.colors.accentPetrol,
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  Follow up
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedJob && (
          <FollowUpModal
            job={selectedJob}
            days={daysSince(selectedJob.dateApplied) ?? 0}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
