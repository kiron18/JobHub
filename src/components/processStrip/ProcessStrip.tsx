import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Eye, Check } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useProcessProgress } from './useProcessProgress';
import { PROCESS_STEPS } from './types';
import { ProcessStripTooltip } from './ProcessStripTooltip';
import { warm } from '../../lib/theme/warmTokens';

const LS_EDIT_TOOLTIP_SHOWN = 'jobhub_tooltip_edit_shown';
const LS_TRACK_TOOLTIP_SHOWN = 'jobhub_tooltip_track_shown';

const STEP_CAPTIONS: Record<string, string> = {
  paste: "Paste a job listing — we'll tailor your CV and cover letter in 3 minutes.",
  analyse: "Hit Analyse. We'll build your tailored resume and cover letter.",
  tailor: 'Review the documents we drafted. Tweak anything that doesn’t feel like you.',
  save: "Save your edits — this creates the application in your tracker.",
  track: "Mark the role as APPLIED once you've sent it. We'll automate the follow-ups.",
};

const STEP_LABELS: Record<string, string> = {
  paste: 'Paste',
  analyse: 'Analyse',
  tailor: 'Tailor',
  save: 'Save',
  track: 'Track',
};

const STYLE_WRAPPER: React.CSSProperties = {
  width: '100%',
  maxWidth: 720,
  margin: '0 auto',
  padding: '16px 20px',
  background: warm.colors.bgSurface,
  border: `1px solid ${warm.colors.borderWhisper}`,
  borderRadius: warm.radius.card,
  boxShadow: warm.shadow.soft,
  position: 'relative',
};

const STYLE_HIDE_BTN: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: warm.colors.textMuted,
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
};

const STYLE_NODE_CIRCLE: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: warm.type.fontBody,
  flexShrink: 0,
};

const STYLE_CONNECTOR: React.CSSProperties = {
  height: 2,
  flex: 1,
  minWidth: 12,
};

const STYLE_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'center' as const,
  marginTop: 4,
};

const STYLE_CAPTION: React.CSSProperties = {
  fontSize: 12,
  color: warm.colors.textSecondary,
  lineHeight: 1.5,
  marginTop: 12,
  textAlign: 'center',
};

const SHOW_PILL_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 60,
  background: warm.colors.bgSurface,
  border: `1px solid ${warm.colors.borderWhisper}`,
  borderRadius: warm.radius.pill,
  padding: '8px 14px',
  fontSize: 11,
  fontWeight: 700,
  color: warm.colors.textSecondary,
  boxShadow: warm.shadow.soft,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

export const ProcessStrip: React.FC = () => {
  const { currentStep, completedSteps, isHidden, isManuallyHidden, isRetired, hide, show } = useProcessProgress();
  const location = useLocation();

  // One-shot tooltip gates. Once shown and dismissed, never re-show.
  const [showEditTip, setShowEditTip] = useState(
    () => completedSteps.includes('tailor') && localStorage.getItem(LS_EDIT_TOOLTIP_SHOWN) !== 'true'
  );
  const [showTrackTip, setShowTrackTip] = useState(
    () => completedSteps.includes('save') && !completedSteps.includes('track') && localStorage.getItem(LS_TRACK_TOOLTIP_SHOWN) !== 'true'
  );

  // React to step transitions: open the edit tip the first time Tailor flips,
  // open the track tip the first time Save flips (and Track is still pending).
  useEffect(() => {
    if (completedSteps.includes('tailor') && localStorage.getItem(LS_EDIT_TOOLTIP_SHOWN) !== 'true') {
      setShowEditTip(true);
    }
  }, [completedSteps]);

  useEffect(() => {
    if (
      completedSteps.includes('save') &&
      !completedSteps.includes('track') &&
      localStorage.getItem(LS_TRACK_TOOLTIP_SHOWN) !== 'true'
    ) {
      setShowTrackTip(true);
    }
  }, [completedSteps]);

  const dismissEditTip = () => {
    localStorage.setItem(LS_EDIT_TOOLTIP_SHOWN, 'true');
    setShowEditTip(false);
  };

  const dismissTrackTip = () => {
    localStorage.setItem(LS_TRACK_TOOLTIP_SHOWN, 'true');
    setShowTrackTip(false);
    window.dispatchEvent(new CustomEvent('process:tracked'));
  };

  // On-page target glow via DOM query
  useEffect(() => {
    if (!currentStep) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-process-step="${currentStep}"]`);
      if (!el) return;
      el.classList.add('process-pulse-target');
      requestAnimationFrame(() => {
        // cleanup is handled by the return fn
      });
    });
    return () => {
      cancelAnimationFrame(id);
      const el = document.querySelector(`[data-process-step="${currentStep}"]`);
      if (el) el.classList.remove('process-pulse-target');
    };
  }, [currentStep, location.pathname]);

  // Sidebar Applications nav indicator — glows while the track tooltip is queued
  // or visible so the user can spot the destination even before the tip opens.
  useEffect(() => {
    if (!showTrackTip) return;
    const el = document.querySelector('[data-process-nav="track"]');
    if (!el) return;
    el.classList.add('process-pulse-target');
    return () => { el.classList.remove('process-pulse-target'); };
  }, [showTrackTip, location.pathname]);

  // Tooltips render alongside whichever strip variant is visible (or even when
  // manually hidden — the user should still be able to complete the flow).
  const tooltips = (
    <>
      {showEditTip && (
        <ProcessStripTooltip
          anchorSelector='[data-process-step="tailor"]'
          delayMs={700}
          onDismiss={dismissEditTip}
        >
          Edit any line that doesn't sound like you. Your tone matters more than perfection.
        </ProcessStripTooltip>
      )}
      {showTrackTip && (
        <ProcessStripTooltip
          anchorSelector='[data-process-nav="track"]'
          delayMs={10000}
          dismissLabel="Got it"
          onDismiss={dismissTrackTip}
        >
          Your application lives in <strong>Applications</strong>. Mark it APPLIED once you've sent it — we'll handle the follow-ups.
        </ProcessStripTooltip>
      )}
    </>
  );

  // Retired → render nothing (tooltips skipped too — flow is over).
  if (isRetired) return null;

  // Manually hidden → show pill, but still render tooltips so the flow can complete.
  if (isManuallyHidden) {
    return (
      <>
        <AnimatePresence>
          <motion.button
            key="show-pill"
            onClick={show}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            style={SHOW_PILL_STYLE}
            aria-label="Show progress strip"
          >
            <Eye size={12} />
            Show progress
          </motion.button>
        </AnimatePresence>
        {tooltips}
      </>
    );
  }

  // isHidden could also be true due to isRetired, but we already handled that above.
  // If isHidden but !isRetired and !isManuallyHidden, it shouldn't happen given logic.
  // Just guard:
  if (isHidden) return null;

  const stripBody = (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      role="region"
      aria-label="Application progress"
      style={STYLE_WRAPPER}
    >
      <button
        onClick={hide}
        style={STYLE_HIDE_BTN}
        aria-label="Hide progress strip"
      >
        <EyeOff size={14} />
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '0 4px',
          paddingTop: 8,
        }}
      >
        {PROCESS_STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step);
          const isCurrent = currentStep === step;

          let nodeStyle: React.CSSProperties = { ...STYLE_NODE_CIRCLE };
          let labelStyle: React.CSSProperties = { ...STYLE_LABEL };

          if (isCompleted) {
            nodeStyle = {
              ...nodeStyle,
              background: warm.colors.accentGold,
              color: '#FFFFFF',
            };
          } else if (isCurrent) {
            nodeStyle = {
              ...nodeStyle,
              background: warm.colors.accentPetrol,
              color: '#FFFFFF',
              boxShadow: '0 0 0 2px rgba(45,90,110,0.40)',
            };
            labelStyle = {
              ...labelStyle,
              color: warm.colors.textPrimary,
            };
          } else {
            nodeStyle = {
              ...nodeStyle,
              background: 'transparent',
              border: '1.5px solid rgba(26, 24, 20, 0.08)',
              color: warm.colors.textMuted,
            };
            labelStyle = {
              ...labelStyle,
              color: warm.colors.textMuted,
            };
          }

          return (
            <React.Fragment key={step}>
              {/* Connector before (except first) */}
              {idx > 0 && (
                <div
                  style={{
                    ...STYLE_CONNECTOR,
                    background:
                      completedSteps.includes(PROCESS_STEPS[idx - 1]) && isCompleted
                        ? warm.colors.accentGold
                        : warm.colors.borderWhisper,
                  }}
                />
              )}

              {/* Node + label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  scrollSnapAlign: 'center',
                }}
              >
                <motion.div
                  style={nodeStyle}
                  animate={
                    isCurrent
                      ? {
                          boxShadow: [
                            '0 0 0 0 rgba(45,90,110,0.45)',
                            '0 0 0 6px rgba(45,90,110,0)',
                          ],
                        }
                      : undefined
                  }
                  transition={
                    isCurrent
                      ? {
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }
                      : undefined
                  }
                >
                  {isCompleted ? (
                    <Check size={14} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </motion.div>
                <span style={labelStyle}>{STEP_LABELS[step]}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Caption */}
      {currentStep && (
        <p style={STYLE_CAPTION}>{STEP_CAPTIONS[currentStep]}</p>
      )}
    </motion.div>
  );

  return (
    <>
      {stripBody}
      {tooltips}
    </>
  );
};
