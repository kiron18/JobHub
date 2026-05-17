import { useState } from 'react';
import { ArrowUpRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { exportPdf } from '../../lib/exportPdf';
import { exportDocx } from '../../lib/exportDocx';

interface ApplyDeepLinkButtonProps {
  resumeMarkdown: string;
  coverLetterMarkdown: string;
  candidateName: string;
  jobTitle?: string;
  company?: string;
  /** If known, opens this URL in a new tab so the user can paste/upload there. */
  sourceUrl?: string | null;
  /** Display name for the destination platform ("Seek", "LinkedIn", etc.) */
  sourcePlatform?: string | null;
  /** If this application came from a feed item, transition it server-side to APPLIED. */
  feedItemId?: string | null;
}

function platformLabel(sourcePlatform?: string | null, sourceUrl?: string | null): string {
  const p = (sourcePlatform ?? '').toLowerCase();
  if (p === 'seek') return 'Seek';
  if (p === 'linkedin') return 'LinkedIn';
  if (p === 'indeed') return 'Indeed';
  if (p === 'jora') return 'Jora';
  if (sourceUrl) {
    try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  }
  return 'the listing';
}

export function ApplyDeepLinkButton({
  resumeMarkdown,
  coverLetterMarkdown,
  candidateName,
  jobTitle,
  company,
  sourceUrl,
  sourcePlatform,
  feedItemId,
}: ApplyDeepLinkButtonProps) {
  const { T } = useAppTheme();
  const [busy, setBusy] = useState<'idle' | 'pdf' | 'docx'>('idle');

  const label = platformLabel(sourcePlatform, sourceUrl);
  // Only show the "Apply on X" framing when we actually have a URL to deep-link
  // into. For pasted JDs we have no listing to send them to, so the button
  // honestly says what it does: download + copy.
  const canDeepLink = Boolean(sourceUrl);
  const hasResume = resumeMarkdown.trim().length > 0;
  const hasCover  = coverLetterMarkdown.trim().length > 0;
  const ready = hasResume && hasCover;

  async function runApplyFlow(format: 'pdf' | 'docx') {
    if (!ready) return;
    setBusy(format);
    try {
      // 1. Copy cover letter to clipboard so the user can paste it as a message
      //    or letter field on the destination site.
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(coverLetterMarkdown);
        }
      } catch {
        // Clipboard write can fail in non-secure contexts; not fatal.
      }

      // 2. Download both documents in the chosen format.
      if (format === 'pdf') {
        await exportPdf(resumeMarkdown, 'resume', candidateName, jobTitle, company);
        await exportPdf(coverLetterMarkdown, 'cover-letter', candidateName, jobTitle, company);
      } else {
        await exportDocx(resumeMarkdown, 'resume', candidateName, jobTitle, company);
        await exportDocx(coverLetterMarkdown, 'cover-letter', candidateName, jobTitle, company);
      }

      // 3. Mark the feed item as applied (creates JobApplication if missing
      //    or updates the existing one to APPLIED with today's date).
      if (feedItemId) {
        api.post(`/job-feed/${feedItemId}/mark-applied`).catch(() => {
          // Tracker save isn't critical to the user's apply action; don't block.
        });
      }

      // 4. Open the destination listing in a new tab.
      if (sourceUrl) {
        window.open(sourceUrl, '_blank', 'noopener,noreferrer');
      }

      toast.success(
        sourceUrl
          ? `Cover letter copied. ${format.toUpperCase()}s downloaded. Opening ${label}…`
          : `Cover letter copied. ${format.toUpperCase()}s downloaded. Apply on the listing site.`
      );
    } catch (err: any) {
      console.error('[ApplyDeepLinkButton]', err);
      toast.error('Could not prepare your application. Try downloading manually below.');
    } finally {
      setBusy('idle');
    }
  }

  if (!ready) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button
        onClick={() => runApplyFlow('pdf')}
        disabled={busy !== 'idle'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: T.accentSuccess,
          color: '#0f1717',
          border: 'none',
          borderRadius: 12,
          padding: '13px 22px',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          cursor: busy !== 'idle' ? 'wait' : 'pointer',
          opacity: busy !== 'idle' ? 0.7 : 1,
          boxShadow: '0 4px 16px rgba(125,166,125,0.20)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => { if (busy === 'idle') e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {busy === 'pdf' ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Preparing…
          </>
        ) : canDeepLink ? (
          <>
            Apply on {label}
            <ArrowUpRight size={15} />
          </>
        ) : (
          <>
            Get my docs
            <Download size={15} />
          </>
        )}
      </button>
      <button
        onClick={() => runApplyFlow('docx')}
        disabled={busy !== 'idle'}
        style={{
          background: 'transparent',
          border: 'none',
          color: T.textMuted,
          fontSize: 11,
          fontWeight: 600,
          cursor: busy !== 'idle' ? 'wait' : 'pointer',
          padding: '2px 0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {busy === 'docx' ? (
          <>
            <Loader2 size={10} className="animate-spin" /> Preparing DOCX…
          </>
        ) : (
          <>
            <Download size={10} /> Download as DOCX instead
          </>
        )}
      </button>
    </div>
  );
}
