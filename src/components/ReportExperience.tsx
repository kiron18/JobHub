import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon } from 'lucide-react';
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

function makeTheme(isDark: boolean) {
  return isDark ? {
    bg: '#0d1117',
    eyebrow: '#4b5563',
    heading: '#f3f4f6',
    sub: '#6b7280',
    ctaBg: 'rgba(252,211,77,0.04)',
    ctaBorder: 'rgba(252,211,77,0.15)',
    ctaEyebrow: '#FCD34D',
    ctaHeading: '#f3f4f6',
    ctaBody: '#6b7280',
    toggleBg: 'rgba(255,255,255,0.08)',
    toggleColor: '#9ca3af',
    blobs: [
      'rgba(251,191,36,0.04)',
      'rgba(45,212,191,0.03)',
      'rgba(167,139,250,0.04)',
    ],
  } : {
    bg: '#f5f4f0',
    eyebrow: '#9ca3af',
    heading: '#111827',
    sub: '#6b7280',
    ctaBg: 'rgba(252,211,77,0.10)',
    ctaBorder: 'rgba(252,211,77,0.28)',
    ctaEyebrow: '#b45309',
    ctaHeading: '#111827',
    ctaBody: '#6b7280',
    toggleBg: 'rgba(0,0,0,0.07)',
    toggleColor: '#6b7280',
    blobs: [
      'rgba(251,191,36,0.10)',
      'rgba(45,212,191,0.08)',
      'rgba(167,139,250,0.08)',
    ],
  };
}

export function ReportExperience({ onDone }: ReportExperienceProps) {
  const [isDark, setIsDark] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const theme = makeTheme(isDark);

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
      position: 'fixed',
      inset: 0,
      overflowY: 'auto',
      background: theme.bg,
      zIndex: 10,
      transition: 'background 0.3s',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {[
          { top: '-15%',  left: '-10%',  size: 500, color: theme.blobs[0] },
          { top: '50%',   right: '-8%',  size: 420, color: theme.blobs[1] },
          { bottom: '-10%', left: '30%', size: 380, color: theme.blobs[2] },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 33% 28%, ${b.color} 0%, transparent 70%)`,
            ...b,
          }} />
        ))}
      </div>

      {/* Theme toggle — fixed top-right */}
      <button
        onClick={() => setIsDark(d => !d)}
        aria-label="Toggle dark mode"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 20,
          width: 40,
          height: 40,
          borderRadius: 99,
          background: theme.toggleBg,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.2s',
        }}
      >
        {isDark
          ? <Sun size={16} color={theme.toggleColor} />
          : <Moon size={16} color={theme.toggleColor} />
        }
      </button>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '60px 24px 100px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 48, textAlign: 'center' }}
        >
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: theme.eyebrow,
            marginBottom: 12,
          }}>
            Your diagnosis
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: theme.heading, margin: 0, lineHeight: 1.25 }}>
            Here's what's actually going on.
          </h1>
          <p style={{ fontSize: 15, color: theme.sub, marginTop: 12, lineHeight: 1.6 }}>
            Open each section to see your diagnosis — then unlock your fix.
          </p>
        </motion.div>

        {/* CSS columns masonry — naturally responsive, no JS timing issues */}
        <div style={{ columns: '280px 3', columnGap: 14 }}>
          {sections.map((section) => {
            const meta = SECTION_ICONS[section.key];
            if (!meta) return null;
            const { problem, fix } = splitProblemFix(section.content);
            return (
              <div key={section.key} style={{ breakInside: 'avoid', marginBottom: 14 }}>
                <ReportIsland
                  sectionKey={section.key}
                  meta={meta}
                  problemText={problem}
                  fixText={fix}
                  reportId={reportId}
                  isOpen={!!openMap[section.key]}
                  onToggle={() => handleToggle(section.key)}
                  onNavigate={handleNavigate}
                  isDark={isDark}
                />
              </div>
            );
          })}
        </div>

        {/* End-of-report CTA */}
        {sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: 48,
              padding: '44px 36px',
              background: theme.ctaBg,
              border: `1px solid ${theme.ctaBorder}`,
              borderRadius: 24,
              textAlign: 'center',
            }}
          >
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: theme.ctaEyebrow,
              marginBottom: 12,
              opacity: 0.8,
            }}>
              You've got this
            </p>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: theme.ctaHeading, marginBottom: 8 }}>
              Your game plan is ready.
            </h2>
            <p style={{ fontSize: 15, color: theme.ctaBody, marginBottom: 32, lineHeight: 1.6 }}>
              The market is hard right now — but most people are losing to fixable problems.<br />
              You just found yours.
            </p>
            <button
              onClick={onDone}
              style={{
                background: '#FCD34D',
                color: '#111827',
                border: 'none',
                borderRadius: 14,
                padding: '14px 40px',
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(252,211,77,0.25)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(252,211,77,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(252,211,77,0.25)';
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
