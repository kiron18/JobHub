import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader2, User, AlertTriangle, EyeOff, BookmarkCheck, BookmarkPlus } from 'lucide-react';
import { getPlatformConfig } from '../../lib/platforms';
import type { JobFeedItem } from './JobCard';

interface Props {
  item: JobFeedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Partial<JobFeedItem> & { id: string }) => void;
  onApply: () => void;
  onSave: () => void;
  onSkip: () => void;
  addresseeLoading: boolean;
  addresseeFetched: boolean;
  addresseeFailed: boolean;
  addresseeOverride: string | null;
  setAddresseeOverride: (val: string | null) => void;
  editingAddressee: boolean;
  setEditingAddressee: (val: boolean) => void;
  saving: boolean;
  isTruncated: boolean;
  fullDescFailed: boolean;
}

export const JobPreviewModal: React.FC<Props> = ({
  item,
  isOpen,
  onClose,
  _onUpdate,
  onApply,
  onSave,
  onSkip,
  addresseeLoading,
  addresseeFetched,
  addresseeFailed,
  addresseeOverride,
  setAddresseeOverride,
  editingAddressee,
  setEditingAddressee,
  saving,
  isTruncated,
  fullDescFailed,
}) => {
  const platform = item ? getPlatformConfig(item.sourcePlatform) : null;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!item || !platform) return null;

  const hasCriteriaHint = ['selection criteria', 'key criteria', 'essential criteria', 'desirable criteria', 'address the criteria']
    .some(k => item.description.toLowerCase().includes(k));

  const displayAddressee = addresseeOverride || item.suggestedAddressee;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-[rgba(26,24,20,0.08)] bg-white">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ color: platform.color, background: platform.bg }}
                  >
                    {platform.label}
                  </span>
                  {item.postedAt && (
                    <span className="text-[10px] text-[#8B847B]">
                      {new Date(item.postedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#1A1814] leading-snug mb-1">
                  {item.title}
                </h2>
                <p className="text-sm text-[#5C5750]">
                  {item.company}
                  {item.location && ` · ${item.location}`}
                  {item.salary && ` · ${item.salary}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-[#F4EFE8] transition-colors"
              >
                <X size={20} className="text-[#8B847B]" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Warnings */}
              {hasCriteriaHint && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">This role may require a selection criteria response, check the full listing for details.</p>
                </div>
              )}

              {item.sourcePlatform === 'seek' && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F4EFE8] border border-[rgba(26,24,20,0.16)]">
                  <AlertTriangle size={13} className="text-[#5C5750] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#5C5750]">
                    Employers on Seek often add screening questions during the application process that don't appear in the listing, worth reviewing before you apply.
                  </p>
                </div>
              )}

              {isTruncated && fullDescFailed && (
                <p className="text-xs text-[#8B847B]">
                  Full description unavailable —{' '}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#5C5750] hover:text-[#1A1814] underline underline-offset-2 transition-colors"
                  >
                    open the listing for complete details →
                  </a>
                </p>
              )}

              {/* Full Description */}
              <div className="prose prose-sm max-w-none">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#8B847B] mb-3">Job Description</h3>
                <div
                  className="text-sm text-[#1A1814] leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: 'inherit' }}
                >
                  {item.description}
                </div>
              </div>

              {/* Addressee Section */}
              <div className="rounded-xl bg-[#F4EFE8]/60 border border-[rgba(26,24,20,0.10)] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-[#8B847B]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#8B847B]">Cover letter, who to address</span>
                </div>

                {addresseeLoading && (
                  <p className="text-xs text-[#8B847B] flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    Finding the right person to address your cover letter to…
                  </p>
                )}

                {!addresseeLoading && addresseeFetched && (
                  displayAddressee ? (
                    editingAddressee ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-white border border-[rgba(26,24,20,0.16)] rounded-lg px-3 py-2 text-sm text-[#1A1814] focus:outline-none focus:border-brand-500"
                          defaultValue={displayAddressee}
                          onBlur={(e) => { setAddresseeOverride(e.target.value); setEditingAddressee(false); }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1814]">
                            {displayAddressee}
                            {item.addresseeTitle && (
                              <span className="font-normal text-[#5C5750]">, {item.addresseeTitle}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-[#8B847B] mt-0.5">
                            {item.addresseeSource === 'job-listing' ? 'Found in job listing' : 'Found via web search'} · verify before sending
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingAddressee(true)}
                          className="text-xs font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-[#8B847B]">No specific contact found, we'll use "Hiring Manager"</p>
                  )
                )}

                {addresseeFailed && (
                  <p className="text-sm text-[#8B847B]">Could not find contact information</p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[rgba(26,24,20,0.08)] bg-[#FDFBF8] flex items-center justify-between gap-4">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-[#8B847B] hover:text-[#1A1814] transition-colors"
              >
                <ExternalLink size={12} />
                View Original
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#8B847B] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors"
                >
                  <EyeOff size={12} />
                  Skip
                </button>

                <button
                  onClick={onSave}
                  disabled={saving || item.isSaved}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-[rgba(26,24,20,0.16)] text-[#5C5750] hover:border-[rgba(26,24,20,0.24)] hover:text-[#1A1814] transition-colors disabled:opacity-40"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={12} className="text-emerald-400" /> : <BookmarkPlus size={12} />}
                  {item.isSaved ? 'Saved' : 'Save'}
                </button>

                <button
                  onClick={onApply}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-80"
                  style={{ background: platform.color }}
                >
                  Apply →
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
