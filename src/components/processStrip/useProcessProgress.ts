import { useEffect, useSyncExternalStore, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProcessProgress, ProcessStep } from './types';
import type { JobApplication } from '../tracker/types';

const LS_HIDDEN = 'jobhub_strip_hidden';
const LS_RETIRED = 'jobhub_strip_retired';
const LS_PASTE_DONE = 'jobhub_step_paste_done';
const LS_ANALYSE_DONE = 'jobhub_step_analyse_done';
const LS_TAILOR_DONE = 'jobhub_step_tailor_done';
const LS_SAVE_DONE = 'jobhub_step_save_done';
const LS_TRACK_DONE = 'jobhub_step_track_done';

const hiddenListeners: Set<() => void> = new Set();

function subscribeHidden(cb: () => void) {
  hiddenListeners.add(cb);
  return () => { hiddenListeners.delete(cb); };
}

function lsTrue(key: string): boolean {
  return localStorage.getItem(key) === 'true';
}

function getManuallyHidden(): boolean { return lsTrue(LS_HIDDEN); }
function getRetired(): boolean        { return lsTrue(LS_RETIRED); }
function getPasteDone(): boolean      { return lsTrue(LS_PASTE_DONE); }
function getAnalyseDone(): boolean    { return lsTrue(LS_ANALYSE_DONE); }
function getTailorDone(): boolean     { return lsTrue(LS_TAILOR_DONE); }
function getSaveDone(): boolean       { return lsTrue(LS_SAVE_DONE); }
function getTrackDone(): boolean      { return lsTrue(LS_TRACK_DONE); }

function emitHiddenChange() {
  hiddenListeners.forEach(fn => fn());
}

export function useProcessProgress(): ProcessProgress & {
  hide: () => void;
  show: () => void;
} {
  const { data: jobs = [] } = useQuery<JobApplication[]>({
    queryKey: ['jobs'],
    staleTime: 30_000,
  });

  const isManuallyHidden = useSyncExternalStore(subscribeHidden, getManuallyHidden);
  const isRetired = useSyncExternalStore(subscribeHidden, getRetired);

  // Subscribe to all per-step flags so re-renders fire when they flip.
  useSyncExternalStore(subscribeHidden, getPasteDone);
  useSyncExternalStore(subscribeHidden, getAnalyseDone);
  useSyncExternalStore(subscribeHidden, getTailorDone);
  useSyncExternalStore(subscribeHidden, getSaveDone);
  useSyncExternalStore(subscribeHidden, getTrackDone);

  // Completion rules: each step has its own explicit signal. Jobs.length > 0
  // remains a backward-compat fallback so existing users with applications
  // don't see the strip rewind.
  const hasJobs = jobs.length > 0;
  const hasPasted   = hasJobs || getPasteDone();
  const hasAnalysed = hasJobs || getAnalyseDone();
  const hasTailored = hasJobs || getTailorDone() || getSaveDone();
  const hasSaved    = getSaveDone();
  const hasTracked  = getTrackDone() || jobs.some(j => ['APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status));

  const completedSteps: ProcessStep[] = [];
  if (hasPasted)   completedSteps.push('paste');
  if (hasAnalysed) completedSteps.push('analyse');
  if (hasTailored) completedSteps.push('tailor');
  if (hasSaved)    completedSteps.push('save');
  if (hasTracked)  completedSteps.push('track');

  const currentStep: ProcessStep | null = (() => {
    if (!hasPasted) return 'paste';
    if (!hasAnalysed) return 'analyse';
    if (!hasTailored) return 'tailor';
    if (!hasSaved) return 'save';
    if (!hasTracked) return 'track';
    return null;
  })();

  const hide = useCallback(() => {
    localStorage.setItem(LS_HIDDEN, 'true');
    emitHiddenChange();
  }, []);

  const show = useCallback(() => {
    localStorage.removeItem(LS_HIDDEN);
    emitHiddenChange();
  }, []);

  // Wire the per-step event dispatches. Each one writes its localStorage flag
  // and emits the change so consumers re-render immediately.
  useEffect(() => {
    const handlePasted   = () => { localStorage.setItem(LS_PASTE_DONE, 'true');   emitHiddenChange(); };
    const handleAnalysed = () => { localStorage.setItem(LS_ANALYSE_DONE, 'true'); emitHiddenChange(); };
    const handleTailored = () => { localStorage.setItem(LS_TAILOR_DONE, 'true');  emitHiddenChange(); };
    const handleSaved    = () => { localStorage.setItem(LS_SAVE_DONE, 'true');    emitHiddenChange(); };
    const handleTracked  = () => { localStorage.setItem(LS_TRACK_DONE, 'true');   emitHiddenChange(); };

    window.addEventListener('process:pasted',   handlePasted);
    window.addEventListener('process:analysed', handleAnalysed);
    window.addEventListener('process:tailored', handleTailored);
    window.addEventListener('process:saved',    handleSaved);
    window.addEventListener('process:tracked',  handleTracked);
    return () => {
      window.removeEventListener('process:pasted',   handlePasted);
      window.removeEventListener('process:analysed', handleAnalysed);
      window.removeEventListener('process:tailored', handleTailored);
      window.removeEventListener('process:saved',    handleSaved);
      window.removeEventListener('process:tracked',  handleTracked);
    };
  }, []);

  // Retire the strip when any job reaches APPLIED / INTERVIEW / OFFER —
  // independent of the in-flow tooltip-driven "track" flag.
  useEffect(() => {
    if (isRetired) return;
    if (jobs.some(j => ['APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status))) {
      localStorage.setItem(LS_RETIRED, 'true');
      emitHiddenChange();
    }
  }, [jobs, isRetired]);

  // Once Track flips via the tooltip-driven flow (no APPLIED status yet),
  // collapse the strip to its show-pill so the user can re-open it later.
  // We do NOT auto-retire here — retirement still requires real APPLIED status.
  useEffect(() => {
    if (isRetired || isManuallyHidden) return;
    if (currentStep === null && hasTracked) {
      localStorage.setItem(LS_HIDDEN, 'true');
      emitHiddenChange();
    }
  }, [currentStep, hasTracked, isRetired, isManuallyHidden]);

  return {
    currentStep,
    completedSteps,
    isHidden: isRetired || isManuallyHidden,
    isManuallyHidden,
    isRetired,
    hide,
    show,
  };
}
