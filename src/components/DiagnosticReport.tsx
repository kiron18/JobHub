import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';

const SECTIONS = [
  { key: 'targeting', heading: 'Targeting Assessment' },
  { key: 'document_audit', heading: 'Document Audit' },
  { key: 'pipeline', heading: 'Pipeline Diagnosis' },
  { key: 'honest', heading: 'The Honest Assessment' },
  { key: 'fix', heading: 'The 3-Step Fix' },
  { key: 'what_jobhub_does', heading: 'What JobHub Will Do For You' },
];

function RelevancePills({
  reportId,
  sectionKey,
}: {
  reportId: string;
  sectionKey: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (score: string) =>
      api.post(`/onboarding/report/${reportId}/feedback`, {
        sectionKey,
        relevanceScore: score,
      }),
  });

  if (selected) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-white/20 mt-3 pl-1"
      >
        Noted — thanks.
      </motion.p>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-4 flex-wrap">
      <span className="text-xs text-white/30">Did this reflect your situation?</span>
      {[
        { score: 'spot_on', label: 'Spot on' },
        { score: 'partially', label: 'Partially' },
        { score: 'missed', label: 'Missed the mark' },
      ].map(({ score, label }) => (
        <button
          key={score}
          onClick={() => {
            setSelected(score);
            mutation.mutate(score);
          }}
          className="px-3 py-1 rounded-full text-xs font-semibold border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 transition-all"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReportSection({
  content,
  reportId,
  sectionKey,
  delay,
}: {
  content: string;
  reportId: string;
  sectionKey: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="border-b border-white/5 pb-8 mb-8 last:border-0 last:mb-0"
    >
      <div className="text-white/80 text-sm leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-base [&_h2]:mb-3 [&_h3]:text-white/90 [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-white">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <RelevancePills reportId={reportId} sectionKey={sectionKey} />
    </motion.div>
  );
}

/**
 * Parses the flat markdown report into sections by heading.
 * Expects headings like "## Targeting Assessment".
 */
function parseReportSections(markdown: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) result[currentKey] = buffer.join('\n').trim();
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      flush();
      const headingText = headingMatch[1].trim();
      const section = SECTIONS.find(s => s.heading === headingText);
      currentKey = section?.key ?? null;
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  flush();
  return result;
}

export function DiagnosticReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['diagnosticReport'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/report');
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading || !data?.reportMarkdown) return null;

  const sections = parseReportSections(data.reportMarkdown);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-indigo-400/70 mb-1">Your Diagnosis</p>
          <h2 className="text-3xl font-black text-white">Here's what we found.</h2>
          <p className="text-white/40 text-sm mt-1">
            Read through each section. Use the feedback buttons — they help us improve the accuracy of this report over time.
          </p>
        </motion.div>

        {SECTIONS.map((section, i) => {
          const content = sections[section.key];
          if (!content) return null;
          return (
            <ReportSection
              key={section.key}
              content={`## ${section.heading}\n\n${content}`}
              reportId={data.reportId}
              sectionKey={section.key}
              delay={0.1 + i * 0.15}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
