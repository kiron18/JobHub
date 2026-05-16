import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface PostDiagnosticChoiceProps {
  /** Called when the user chooses to skip the diagnostic and start applying. */
  onApplyNow: () => void;
  /** Called when the user chooses to read the full diagnostic first. */
  onSeeDiagnostic: () => void;
  /** Optional first name for a personalised greeting. */
  firstName?: string | null;
}

export function PostDiagnosticChoice({ onApplyNow, onSeeDiagnostic, firstName }: PostDiagnosticChoiceProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b12',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
        style={{ maxWidth: 560, width: '100%' }}
      >
        <p style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: '#4b5563',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Your diagnostic is ready
        </p>

        <h1 style={{
          margin: '0 0 18px',
          fontSize: 28,
          fontWeight: 800,
          color: '#E0E0E0',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          textAlign: 'center',
        }}>
          {firstName ? `${firstName}, your resume is parsed.` : 'Your resume is parsed.'}
          <br />
          <span style={{ color: '#C5A059' }}>We found 3 things quietly killing your applications.</span>
        </h1>

        <p style={{
          margin: '0 0 36px',
          fontSize: 15,
          color: '#A0A4A8',
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 440,
          marginInline: 'auto',
        }}>
          You can fix them right now by generating a tailored application — or read the full diagnostic first if you want the detail.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <button
            onClick={onApplyNow}
            aria-label="Start applying with your improved resume"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#2D5A6E',
              color: '#E0E0E0',
              border: 'none',
              borderRadius: 14,
              padding: '17px 36px',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 24px rgba(45,90,110,0.35)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Start applying with your improved resume
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onSeeDiagnostic}
            aria-label="See the full diagnostic first"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 12px',
              letterSpacing: '-0.01em',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e7eb'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
          >
            or see what we found  →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
