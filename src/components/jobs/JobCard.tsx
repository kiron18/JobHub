import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Loader2, BookmarkPlus, BookmarkCheck, Zap, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

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
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  seek:     { label: 'Seek',     color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  indeed:   { label: 'Indeed',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  jora:     { label: 'Jora',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  linkedin: { label: 'LinkedIn', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  other:    { label: 'Job Board', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function daysAgo(iso: string | null): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#fbbf24';
  return '#f87171';
}

const CRITERIA_KEYWORDS = ['selection criteria', 'key criteria', 'essential criteria', 'desirable criteria', 'address the criteria'];

interface Props {
  item: JobFeedItem;
  onUpdate: (updated: Partial<JobFeedItem> & { id: string }) => void;
}

export const JobCard: React.FC<Props> = ({ item, onUpdate }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addresseeLoading, setAddresseeLoading] = useState(false);
  const [addresseeFailed, setAddresseeFailed] = useState(false);
  const [addresseeOverride, setAddresseeOverride] = useState<string | null>(null);
  const [editingAddressee, setEditingAddressee] = useState(false);
  const [loadingFullDesc, setLoadingFullDesc] = useState(false);
  const [fullDescFailed, setFullDescFailed] = useState(false);
  const [fullDescLoaded, setFullDescLoaded] = useState(false);

  const platform = PLATFORM_CONFIG[item.sourcePlatform] ?? PLATFORM_CONFIG.other;
  const hasCriteriaHint = CRITERIA_KEYWORDS.some(k => item.description.toLowerCase().includes(k));
  const addresseeFetched = item.addresseeSource !== null;
  // Adzuna truncates descriptions — warn and offer to fetch the full version
  const isTruncated = !fullDescLoaded && (
    item.description.endsWith('...') || item.description.endsWith('…') || item.description.length < 600
  );

  const handleExpand = async () => {
    const nowExpanded = !expanded;
    setExpanded(nowExpanded);

    if (nowExpanded && !addresseeFetched && !addresseeLoading && !addresseeFailed) {
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

  const handleScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scoring || item.matchScore !== null) return;
    setScoring(true);
    try {
      const { data } = await api.post(`/job-feed/${item.id}/score`);
      onUpdate({ id: item.id, matchScore: data.matchScore, matchDetails: data.matchDetails });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Scoring failed — try again.');
    } finally {
      setScoring(false);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleLoadFullDesc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingFullDesc(true);
    setFullDescFailed(false);
    try {
      const { data } = await api.post(`/job-feed/${item.id}/fetch-description`);
      onUpdate({ id: item.id, description: data.description });
      setFullDescLoaded(true);
    } catch (err: any) {
      setFullDescFailed(true);
      toast.error(err?.response?.data?.error ?? 'Could not load full description');
    } finally {
      setLoadingFullDesc(false);
    }
  };

  const handleGenerateDocs = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('jobhub_current_jd', item.description);
    navigate('/');
    toast.success('Job description loaded — click Analyse to start');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* ── Collapsed header (always visible) ── */}
      <div
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={handleExpand}
      >
        {/* Row 1: platform + date + score action */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: platform.color, background: platform.bg }}
            >
              {platform.label}
            </span>
            {item.postedAt && (
              <span className="text-[10px] text-slate-500">{daysAgo(item.postedAt)}</span>
            )}
          </div>

          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {item.matchScore !== null ? (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ color: scoreColor(item.matchScore), background: `${scoreColor(item.matchScore)}18` }}
              >
                {item.matchScore}/100 match
              </span>
            ) : (
              <button
                onClick={handleScore}
                disabled={scoring}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-brand-400 transition-colors disabled:opacity-40"
              >
                {scoring ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                {scoring ? 'Analysing…' : 'Analyse match'}
              </button>
            )}
            {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
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
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ExternalLink size={11} />
            Open
          </a>
        </div>

        {/* Row 3: meta */}
        <p className="text-xs text-slate-500 mb-3">
          {item.company}
          {item.location && ` · ${item.location}`}
          {item.salary && ` · ${item.salary}`}
        </p>

        {/* Bullets */}
        {item.bullets ? (
          <ul className="space-y-1">
            {(item.bullets as string[]).map((b, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-brand-500 mt-0.5 flex-shrink-0">·</span>
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1.5">
            {[70, 55, 85].map(w => (
              <div key={w} className="h-2.5 rounded bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Match gaps (shown after scoring) */}
        {item.matchDetails?.gaps && item.matchDetails.gaps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.matchDetails.gaps.slice(0, 4).map((gap, i) => (
              <span key={i} className="text-[9px] font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                gap: {gap}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Expanded section ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-800"
          >
            <div className="p-4 space-y-4">
              {/* Selection criteria warning */}
              {hasCriteriaHint && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">This role may require a selection criteria response — check the full listing for details.</p>
                </div>
              )}

              {/* Truncation warning */}
              {isTruncated && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300 flex-1">
                    Description is a preview — cover letter quality may suffer without the full text.
                  </p>
                  {!fullDescFailed && (
                    <button
                      onClick={handleLoadFullDesc}
                      disabled={loadingFullDesc}
                      className="text-[10px] font-black text-amber-300 hover:text-amber-100 border border-amber-500/30 rounded px-2 py-0.5 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {loadingFullDesc ? <Loader2 size={10} className="animate-spin inline" /> : 'Load full →'}
                    </button>
                  )}
                  {fullDescFailed && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] font-black text-amber-300 hover:text-amber-100 border border-amber-500/30 rounded px-2 py-0.5 transition-colors whitespace-nowrap"
                    >
                      Open listing →
                    </a>
                  )}
                </div>
              )}

              {/* Full description */}
              <div
                className="text-xs text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar"
                style={{ maxHeight: 360, whiteSpace: 'pre-wrap' }}
              >
                {item.description}
              </div>

              {/* Addressee section */}
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <User size={12} className="text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cover letter — who to address</span>
                </div>

                {addresseeLoading && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    Finding the right person to address your cover letter to…
                  </p>
                )}

                {!addresseeLoading && addresseeFetched && (
                  item.suggestedAddressee ? (
                    editingAddressee ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                          defaultValue={addresseeOverride ?? item.suggestedAddressee}
                          onBlur={e => { setAddresseeOverride(e.target.value); setEditingAddressee(false); }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {addresseeOverride || item.suggestedAddressee}
                            {(item.addresseeTitle) && (
                              <span className="font-normal text-slate-400">, {item.addresseeTitle}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.addresseeSource === 'job-listing' ? 'Found in job listing' : 'Found via web search'} · verify before sending
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingAddressee(true)}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-slate-500">No specific contact found — we'll use "Hiring Manager"</p>
                  )
                )}

                {!addresseeLoading && !addresseeFetched && !addresseeFailed && (
                  <p className="text-xs text-slate-500 italic">Searching…</p>
                )}
                {addresseeFailed && (
                  <p className="text-xs text-slate-500">Could not find contact information</p>
                )}
              </div>

              {/* Apply section */}
              <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-3 space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-200">We build the documents. You make the move.</span>{' '}
                  Applying directly signals genuine intent — hiring managers notice candidates who submit personally.
                  Your application gets individual attention, not a filtered queue.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white transition-colors"
                    style={{ background: platform.color }}
                  >
                    <ExternalLink size={11} />
                    Apply on {platform.label}
                  </a>
                  <button
                    onClick={handleGenerateDocs}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 transition-colors"
                  >
                    Generate documents
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || item.isSaved}
                    title={item.isSaved ? 'Already saved to tracker' : 'Save to tracker'}
                    aria-label={item.isSaved ? 'Already saved to tracker' : 'Save to tracker'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : item.isSaved ? <BookmarkCheck size={11} className="text-emerald-400" /> : <BookmarkPlus size={11} />}
                    {item.isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
