import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../lib/api';

interface JDSummary {
  roleType?: string | null;
  experienceYears?: string | null;
  keySkills?: string[];
  arrangement?: string | null;
  employmentType?: string | null;
  salaryMentioned?: string | null;
  closingDate?: string | null;
  securityClearance?: string | null;
}

interface JDSummaryBarProps {
  jobDescription: string;
}

const ARRANGEMENT_COLOR: Record<string, string> = {
  Remote: '#34d399',
  Hybrid: '#818cf8',
  Flexible: '#818cf8',
  'On-site': '#fbbf24',
};

const EMP_TYPE_COLOR: Record<string, string> = {
  'Full-time': '#34d399',
  Contract: '#f59e0b',
  Casual: '#f59e0b',
  'Part-time': '#94a3b8',
  'Fixed-term': '#f59e0b',
};

export function JDSummaryBar({ jobDescription }: JDSummaryBarProps) {
  const [summary, setSummary] = useState<JDSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobDescription || jobDescription.length < 50) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data } = await api.post('/analyze/jd-summary', { jobDescription });
        if (!cancelled) setSummary(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Debounce: only fire after JD settles for 1s
    const t = setTimeout(run, 1000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [jobDescription]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', color: '#4b5563', fontSize: 11 }}>
        <Loader2 size={11} className="animate-spin" />
        <span>Parsing job description...</span>
      </div>
    );
  }

  if (!summary) return null;

  const chips: Array<{ label: string; value: string; color?: string }> = [];

  if (summary.roleType) chips.push({ label: 'Role', value: summary.roleType });
  if (summary.experienceYears) chips.push({ label: 'Experience', value: summary.experienceYears });
  if (summary.employmentType) chips.push({ label: 'Type', value: summary.employmentType, color: EMP_TYPE_COLOR[summary.employmentType] });
  if (summary.arrangement) chips.push({ label: 'Work', value: summary.arrangement, color: ARRANGEMENT_COLOR[summary.arrangement] });
  if (summary.salaryMentioned) chips.push({ label: 'Salary', value: summary.salaryMentioned, color: '#34d399' });
  if (summary.securityClearance) chips.push({ label: 'Clearance', value: summary.securityClearance, color: '#f87171' });
  if (summary.closingDate) chips.push({ label: 'Closes', value: summary.closingDate, color: '#fbbf24' });

  if (chips.length === 0 && (!summary.keySkills || summary.keySkills.length === 0)) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0 4px 0' }}>
      {/* Role chips row */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {chips.map(chip => (
            <span
              key={chip.label}
              style={{
                display: 'inline-flex', gap: 4, alignItems: 'center',
                padding: '2px 8px', borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                fontSize: 10,
              }}
            >
              <span style={{ color: '#4b5563', fontWeight: 600 }}>{chip.label}</span>
              <span style={{ color: chip.color || '#94a3b8', fontWeight: 700 }}>{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Key skills */}
      {summary.keySkills && summary.keySkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {summary.keySkills.slice(0, 8).map((skill, i) => (
            <span
              key={i}
              style={{
                padding: '2px 7px', borderRadius: 5,
                border: '1px solid rgba(99,102,241,0.2)',
                background: 'rgba(99,102,241,0.06)',
                color: '#a5b4fc', fontSize: 10, fontWeight: 600,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
