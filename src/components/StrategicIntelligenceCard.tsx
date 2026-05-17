import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  INSIGHT_TRACK,
  isUnlocked,
  applicationsUntilUnlock,
  type InsightKey,
  type InsightDef,
} from '../lib/strategicIntelligence';
import { ApplicationPatternInsight } from './insights/ApplicationPatternInsight';
import { InsightPlaceholder } from './insights/InsightPlaceholder';

export function StrategicIntelligenceCard() {
  const { T } = useAppTheme();

  const { data: count } = useQuery({
    queryKey: ['jobs', 'sent-count'],
    queryFn: async () => (await api.get('/jobs/sent-count')).data?.count ?? 0,
    staleTime: 60 * 1000,
  });
  const applicationsSent: number = count ?? 0;

  const [expanded, setExpanded] = useState<InsightKey | null>(null);

  function toggle(key: InsightKey, insight: InsightDef) {
    if (!isUnlocked(insight, applicationsSent)) return;
    setExpanded(prev => (prev === key ? null : key));
  }

  function renderInsightBody(key: InsightKey, def: InsightDef) {
    if (!def.implemented) {
      return <InsightPlaceholder title={def.label} description={def.description} />;
    }
    if (key === 'diagnostic') {
      return (
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.55 }}>
          Open the Diagnostic from the sidebar to revisit your starting baseline.
        </p>
      );
    }
    if (key === 'application-pattern') return <ApplicationPatternInsight />;
    return <InsightPlaceholder title={def.label} description={def.description} />;
  }

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 16,
      padding: 22,
      boxShadow: T.cardShadow,
    }}>
      <p style={{
        margin: '0 0 4px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: T.accentSuccess,
        textTransform: 'uppercase',
      }}>
        Strategic Intelligence
      </p>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: T.textMuted }}>
        Insights unlock as you apply. {applicationsSent} application{applicationsSent === 1 ? '' : 's'} sent so far.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSIGHT_TRACK.map(def => {
          const unlocked = isUnlocked(def, applicationsSent);
          const isOpen = expanded === def.key;
          const until = applicationsUntilUnlock(def, applicationsSent);

          return (
            <div key={def.key} style={{
              borderRadius: 12,
              border: `1px solid ${T.cardBorder}`,
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(def.key, def)}
                disabled={!unlocked}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: unlocked ? T.text : T.textMuted,
                  cursor: unlocked ? 'pointer' : 'default',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {unlocked
                  ? <Unlock size={14} style={{ color: T.accentSuccess, flexShrink: 0 }} />
                  : <Lock size={14} style={{ color: T.textMuted, opacity: 0.6, flexShrink: 0 }} />
                }
                <span style={{ flex: 1 }}>{def.label}</span>
                {unlocked
                  ? <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                  : <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                      {until} application{until === 1 ? '' : 's'} to unlock
                    </span>
                }
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '4px 16px 16px' }}>
                      {renderInsightBody(def.key, def)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
