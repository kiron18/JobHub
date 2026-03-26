import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { parseReportSections, splitProblemFix } from '../lib/parseReport';
import { SECTION_ICONS } from '../lib/reportIcons';
import { ReportIsland } from './ReportIsland';

interface ReportExperienceProps {
  onDone: () => void;
}

interface ReportData {
  reportId: string;
  status: string;
  reportMarkdown: string | null;
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const { data } = useQuery<ReportData>({
    queryKey: ['report'],
    queryFn: async () => {
      const res = await api.get<ReportData>('/onboarding/report');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const sections = parseReportSections(data?.reportMarkdown ?? '');
  const reportId = data?.reportId ?? '';

  function handleToggle(key: string) {
    setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleNavigate(key: string) {
    setOpenMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      document.getElementById(`report-island-${key}`)?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
    }, 50);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0d1117',
      overflowY: 'auto',
    }}>
      {/* Blobs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {[
          { top: '-15%', left: '-10%', size: 500 },
          { top: '50%',  right: '-8%', size: 420 },
          { bottom: '-10%', left: '30%', size: 380 },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: b.size, height: b.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 33% 28%, #1e2535 0%, #131924 55%, #0d1117 100%)',
            boxShadow: 'inset -10px -10px 28px rgba(0,0,0,0.6), inset 5px 5px 18px rgba(255,255,255,0.03), 20px 32px 80px rgba(0,0,0,0.5)',
            ...b,
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '60px 20px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 12 }}>
            Your diagnosis
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f3f4f6', margin: 0, lineHeight: 1.3 }}>
            Here's what's actually going on.
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', marginTop: 12 }}>
            Open each section to see your diagnosis, then unlock the fix.
          </p>
        </div>

        {/* Islands */}
        {sections.map(section => {
          const meta = SECTION_ICONS[section.key];
          if (!meta) return null;
          const { problem, fix } = splitProblemFix(section.content);
          return (
            <ReportIsland
              key={section.key}
              sectionKey={section.key}
              meta={meta}
              problemText={problem}
              fixText={fix}
              reportId={reportId}
              isOpen={!!openMap[section.key]}
              onToggle={() => handleToggle(section.key)}
              onNavigate={handleNavigate}
            />
          );
        })}

        {/* End-of-report CTA */}
        {sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              marginTop: 48,
              padding: '40px 32px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 24,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f3f4f6', marginBottom: 8 }}>
              Your game plan is ready.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 28 }}>
              Time to put it to work.
            </p>
            <button
              onClick={onDone}
              style={{
                background: '#f3f4f6',
                color: '#111827',
                border: 'none',
                borderRadius: 14,
                padding: '14px 36px',
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              Let's go →
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
