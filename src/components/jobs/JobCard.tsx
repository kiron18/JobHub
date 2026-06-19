import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { getPlatformConfig } from '../../lib/platforms';
import { JobPreviewModal } from './JobPreviewModal';

export interface JobFeedItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  description: string;
  bullets: string[] | null;
  sourceUrl: string;
  sourcePlatform: string;
  postedAt: string | null;
  suggestedAddressee: string | null;
  addresseeTitle: string | null;
  addresseeConfidence: 'high' | 'medium' | 'low' | null;
  addresseeSource: 'job-listing' | 'web-search' | null;
  matchScore: number | null;
  matchDetails: { overallGrade?: string; gaps?: string[]; keywords?: string[] } | null;
  isRead: boolean;
  isSaved: boolean;
  skipped?: boolean;
  applicationStatus: string | null;
}


function daysAgo(iso: string | null): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

interface Props {
  item: JobFeedItem;
  onUpdate: (updated: Partial<JobFeedItem> & { id: string }) => void;
}

export const JobCard: React.FC<Props> = ({ item, onUpdate }) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addresseeLoading, setAddresseeLoading] = useState(false);
  const [addresseeFailed, setAddresseeFailed] = useState(false);
  const [addresseeOverride, setAddresseeOverride] = useState<string | null>(null);
  const [editingAddressee, setEditingAddressee] = useState(false);
  const [loadingFullDesc, setLoadingFullDesc] = useState(false);
  const [fullDescFailed, setFullDescFailed] = useState(false);
  const [fullDescLoaded, setFullDescLoaded] = useState(false);

  const platform = getPlatformConfig(item.sourcePlatform);
  const addresseeFetched = item.addresseeSource !== null;
  const isTruncated = !fullDescLoaded && (
    item.description.endsWith('...') || item.description.endsWith('…') ||
    (item.sourcePlatform === 'other' && item.description.length < 600)
  );

  const openModal = async () => {
    setModalOpen(true);

    // Fetch full description if truncated
    if (isTruncated && !loadingFullDesc && !fullDescFailed) {
      setLoadingFullDesc(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
        onUpdate({ id: item.id, description: data.description });
        setFullDescLoaded(true);
      } catch {
        setFullDescFailed(true);
      } finally {
        setLoadingFullDesc(false);
      }
    }

    // Fetch addressee if not already fetched
    if (!addresseeFetched && !addresseeLoading && !addresseeFailed) {
      setAddresseeLoading(true);
      try {
        const { data } = await api.post(`/job-feed/${item.id}/find-addressee`);
        onUpdate({
          id: item.id,
          suggestedAddressee: data.suggestedAddressee,
          addresseeTitle: data.addresseeTitle,
          addresseeConfidence: data.addresseeConfidence,
          addresseeSource: data.addresseeSource,
        });
      } catch {
        setAddresseeFailed(true);
      } finally {
        setAddresseeLoading(false);
      }
    }
  };

  const handleSkip = async () => {
    try {
      await api.patch(`/job-feed/${item.id}/skip`, { skipped: true });
      toast('Hidden from your feed', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.patch(`/job-feed/${item.id}/skip`, { skipped: false });
              onUpdate({ id: item.id, skipped: false });
            } catch { }
          },
        },
      });
      onUpdate({ id: item.id, skipped: true });
      setModalOpen(false);
    } catch {
      toast.error('Failed to hide job');
    }
  };

  const handleSave = async () => {
    if (saving || item.isSaved) return;
    setSaving(true);
    try {
      await api.post(`/job-feed/${item.id}/save`);
      onUpdate({ id: item.id, isSaved: true });
      toast.success('Saved to tracker');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePrepareAndApply = () => {
    localStorage.setItem('jobhub_current_jd', item.description);
    localStorage.setItem('jobhub_current_job_context', JSON.stringify({
      company: item.company,
      title: item.title,
      suggestedAddressee: addresseeOverride ?? item.suggestedAddressee ?? null,
      matchScore: item.matchScore ?? null,
    }));
    localStorage.setItem('jobhub_apply_context', JSON.stringify({
      jobId: item.id,
      title: item.title,
      company: item.company,
      description: item.description,
      sourceUrl: item.sourceUrl,
      sourcePlatform: item.sourcePlatform,
    }));
    setModalOpen(false);
    navigate('/apply', {
      state: {
        jobDescription: item.description,
        company: item.company,
        role: item.title,
        feedItemId: item.id,
        sourceUrl: item.sourceUrl,
        sourcePlatform: item.sourcePlatform,
      },
    });
    toast.success('Job loaded, generate your documents, then apply');
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* ── Collapsed card (click to open modal) ── */}
        <div
          className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={openModal}
        >
          {/* Row 1: platform + date + status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: platform.color, background: platform.bg }}
              >
                {platform.label}
              </span>
              {item.postedAt && (
                <span className="text-[10px] text-[#8B847B]">{daysAgo(item.postedAt)}</span>
              )}
            </div>

            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {item.applicationStatus && item.applicationStatus !== 'SAVED' && (
                <span
                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: item.applicationStatus === 'REJECTED' ? '#A0A4A8'
                      : item.applicationStatus === 'OFFER' ? '#7DA67D'
                      : item.applicationStatus === 'INTERVIEW' ? '#C5A059'
                      : '#7DA67D',
                    background: item.applicationStatus === 'REJECTED' ? 'rgba(160,164,168,0.10)'
                      : item.applicationStatus === 'OFFER' ? 'rgba(125,166,125,0.12)'
                      : item.applicationStatus === 'INTERVIEW' ? 'rgba(197,160,89,0.12)'
                      : 'rgba(125,166,125,0.10)',
                  }}
                >
                  {item.applicationStatus === 'APPLIED' ? 'Applied'
                    : item.applicationStatus === 'INTERVIEW' ? 'Interviewing'
                    : item.applicationStatus === 'OFFER' ? 'Offer'
                    : item.applicationStatus === 'REJECTED' ? 'Rejected'
                    : item.applicationStatus}
                </span>
              )}
              {(item.isSaved && !item.applicationStatus) || item.applicationStatus === 'SAVED' ? (
                <span className="text-[9px] font-bold text-[#8B847B]">Saved</span>
              ) : null}
            </div>
          </div>

          {/* Row 2: title + external link */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-sm font-bold text-slate-100 leading-snug">{item.title}</p>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
            >
              <ExternalLink size={11} />
              Open
            </a>
          </div>

          {/* Row 3: meta */}
          <p className="text-xs text-[#8B847B] mb-3">
            {item.company}
            {item.location && ` · ${item.location}`}
            {item.salary && ` · ${item.salary}`}
          </p>

          {/* Description preview */}
          <p
            className="text-xs text-[#5C5750] leading-relaxed"
            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.description}
          </p>
        </div>
      </motion.div>

      {/* Modal */}
      <JobPreviewModal
        item={item}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={onUpdate}
        onApply={handlePrepareAndApply}
        onSave={handleSave}
        onSkip={handleSkip}
        addresseeLoading={addresseeLoading}
        addresseeFetched={addresseeFetched}
        addresseeFailed={addresseeFailed}
        addresseeOverride={addresseeOverride}
        setAddresseeOverride={setAddresseeOverride}
        editingAddressee={editingAddressee}
        setEditingAddressee={setEditingAddressee}
        saving={saving}
        isTruncated={isTruncated}
        fullDescFailed={fullDescFailed}
      />
    </>
  );
};
