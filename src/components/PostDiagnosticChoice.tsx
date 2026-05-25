import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { scanProfile, type ProfileIssue } from '../lib/scanProfile';
import { warm } from '../lib/theme/warmTokens';

const PETROL = '#2D5A6E';
const GOLD   = '#C5A059';
const SAGE   = '#7DA67D';

interface PostDiagnosticChoiceProps {
  onApplyNow: () => void;
  onSeeDiagnostic: () => void;
  profile?: any;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function PostDiagnosticChoice({ onApplyNow, onSeeDiagnostic, profile }: PostDiagnosticChoiceProps) {
  const firstName = profile?.name ? toTitleCase(String(profile.name).split(' ')[0]) : null;
  const { issues, totalCritical } = scanProfile(profile);
  const hasIssues = issues.length > 0;

  return (
    <div style={{
      minHeight: '100vh',
      overflowY: 'auto',
      background: warm.colors.bgCanvas,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        style={{ maxWidth: 580, width: '100%' }}
      >
        {/* Label */}
        <p style={{
          margin: '0 0 20px',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.18em',
          color: hasIssues ? GOLD : SAGE,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Resume scan complete
        </p>

        {/* Headline — switches tone based on whether issues were found */}
        {hasIssues ? (
          <h1 style={{
            margin: '0 0 14px',
            fontSize: 'clamp(26px, 5vw, 36px)',
            fontWeight: 900,
            color: warm.colors.textPrimary,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textAlign: 'center',
          }}>
            {firstName ? `${firstName}, we found ` : 'We found '}
            <span style={{ color: GOLD }}>{totalCritical} critical {totalCritical === 1 ? 'issue' : 'issues'}</span>
            {' '}killing your chances
          </h1>
        ) : (
          <h1 style={{
            margin: '0 0 14px',
            fontSize: 'clamp(26px, 5vw, 36px)',
            fontWeight: 900,
            color: warm.colors.textPrimary,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textAlign: 'center',
          }}>
            {firstName ? `${firstName}, your profile ` : 'Your profile '}
            <span style={{ color: SAGE }}>looks solid</span>
            {' '}— no critical gaps detected
          </h1>
        )}

        {/* Subhead — switches tone */}
        {hasIssues ? (
          <p style={{
            margin: '0 auto 32px',
            fontSize: 15,
            color: warm.colors.textSecondary,
            lineHeight: 1.65,
            textAlign: 'center',
            maxWidth: 480,
            fontWeight: 450,
          }}>
            These mistakes are why you're getting auto-rejected. Here's what Australian employers actually see when they scan your resume.
          </p>
        ) : (
          <p style={{
            margin: '0 auto 32px',
            fontSize: 15,
            color: warm.colors.textSecondary,
            lineHeight: 1.65,
            textAlign: 'center',
            maxWidth: 500,
            fontWeight: 450,
          }}>
            Your resume is well-structured and your experience reads clearly. The full diagnostic will double-check everything, but you're in a good place to start applying.
          </p>
        )}

        {/* Dynamic issue teasers — only when issues exist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: hasIssues ? 28 : 32 }}>
          {hasIssues ? (
            issues.map((issue: ProfileIssue, i: number) => (
              <motion.div
                key={issue.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  background: warm.colors.bgAlt,
                  border: `1px solid ${warm.colors.borderWhisper}`,
                  borderLeft: `3px solid ${i === 0 ? GOLD : i === 1 ? PETROL : SAGE}`,
                  borderRadius: 10,
                }}
              >
                <span style={{
                  flexShrink: 0,
                  marginTop: 1,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: i === 0 ? 'rgba(197,160,89,0.15)' : i === 1 ? 'rgba(45,90,110,0.15)' : 'rgba(125,166,125,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: i === 0 ? GOLD : i === 1 ? PETROL : SAGE,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: '0 0 4px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: warm.colors.textPrimary,
                    letterSpacing: '-0.01em',
                  }}>
                    {issue.label}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: warm.colors.textSecondary,
                    lineHeight: 1.55,
                    fontWeight: 450,
                  }}>
                    {issue.detail}
                  </p>
                </div>
              </motion.div>
            ))
          ) : null}
        </div>

        {/* Market stat / body — switches based on issues */}
        {hasIssues ? (
          <p style={{
            margin: '0 auto 36px',
            fontSize: 13,
            color: warm.colors.textMuted,
            lineHeight: 1.6,
            textAlign: 'center',
            maxWidth: 420,
            fontStyle: 'italic',
          }}>
            Your resume has the same problems we see in 89% of international graduate applications. Each one measurably cuts your interview chances.
            <br />
            <span style={{ color: SAGE, fontStyle: 'normal', fontWeight: 600 }}>
              The good news? You can fix {issues.length > 1 ? `all ${issues.length}` : 'it'} in the next 10 minutes.
            </span>
          </p>
        ) : (
          <p style={{
            margin: '0 auto 36px',
            fontSize: 13,
            color: warm.colors.textMuted,
            lineHeight: 1.6,
            textAlign: 'center',
            maxWidth: 420,
            fontStyle: 'italic',
          }}>
            <span style={{ color: SAGE, fontStyle: 'normal', fontWeight: 600 }}>
              The diagnostic is still worth a read
            </span>
            {' '}— it catches things a quick scan misses. Or skip straight to applying.
          </p>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <motion.button
            onClick={onSeeDiagnostic}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              width: '100%',
              maxWidth: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: PETROL,
              color: warm.colors.textPrimary,
              border: 'none',
              borderRadius: 14,
              padding: '16px 32px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: `0 6px 28px ${PETROL}40`,
            }}
          >
            {hasIssues ? 'Show me what\'s wrong' : 'Read the full diagnostic'}
            <ArrowRight size={16} />
          </motion.button>

          <button
            onClick={onApplyNow}
            style={{
              background: 'none',
              border: 'none',
              color: warm.colors.textMuted,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
              letterSpacing: '-0.01em',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#A0A4A8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = warm.colors.textMuted; }}
          >
            {hasIssues ? 'Fix it and start applying →' : 'Start applying now →'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
