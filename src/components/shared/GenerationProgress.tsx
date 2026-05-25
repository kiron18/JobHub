import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

type DocType = 'resume' | 'cover-letter' | 'selection-criteria';

interface GenerationProgressProps {
  docType: DocType;
}

const MESSAGE_INTERVAL_MS = 9_000;
const ASIDE_INTERVAL_MS   = 12_000;
const ASIDE_DELAY_MS      = 5_000;

const RESUME_MESSAGES: string[] = [
  'Pulling the structure recruiters scan first...',
  'Reading the JD for the signals that actually matter here...',
  'Matching your strongest achievements to the must-haves...',
  'Rewriting your bullets so they read like impact, not duties...',
  'Making sure each line earns its place on page one...',
  'Threading the keywords the ATS expects without forcing them...',
  'Tightening every sentence, this is what passes the 6 second scan...',
  'Almost there, doing a final pass for confidence and clarity...',
];

const COVER_LETTER_MESSAGES: string[] = [
  'Reading the role for the human signal underneath the requirements...',
  'Picking the angle most candidates miss for this kind of role...',
  "Building an opening that does not sound like everyone else's...",
  'Connecting your work to what this team actually needs...',
  'Writing the body in your voice, not corporate filler...',
  'Trimming the parts recruiters tend to skip...',
  'Adding the close that makes them want to reply...',
  'Final pass, making sure every line earns its space...',
];

const SC_MESSAGES: string[] = [
  'Reading each criterion carefully for the underlying capability...',
  'Pulling matching evidence from your achievement bank...',
  'Structuring each response in the STAR format the panel expects...',
  'Making sure every claim has a specific example behind it...',
  'Tightening the language, public sector reads precision well...',
  'Adding the impact line that lifts a response from compliant to strong...',
  'Cross checking each criterion is addressed in full...',
  'Almost there, doing a final pass for tone and clarity...',
];

const ASIDES: string[] = [
  'This is where most drafts go generic. Holding the line on specifics.',
  'There is a pattern in your background worth surfacing here.',
  'Recruiters skim. Writing for the skim.',
  'The boring version is easy. Reaching for the version that actually lands.',
  "Choosing the framing that respects the reader's time.",
  'This bit usually decides whether the next page gets read.',
  'Plain language outperforms clever language nine times out of ten.',
  'Anchoring claims to your real numbers, not vague qualifiers.',
];

const FALLBACK_MESSAGE = 'Still working, this one is taking the long route...';

function messagesFor(docType: DocType): string[] {
  if (docType === 'cover-letter') return COVER_LETTER_MESSAGES;
  if (docType === 'selection-criteria') return SC_MESSAGES;
  return RESUME_MESSAGES;
}

export function GenerationProgress({ docType }: GenerationProgressProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [asideIndex, setAsideIndex] = useState(0);
  const [asideVisible, setAsideVisible] = useState(false);

  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const asideRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messages = messagesFor(docType);

  // Reset rotation state on docType change
  useEffect(() => {
    setMsgIndex(0);
    setMsgVisible(true);
    setAsideIndex(0);
    setAsideVisible(false);
  }, [docType]);

  // Main message rotation
  useEffect(() => {
    msgRef.current = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex(i => i + 1);
        setMsgVisible(true);
      }, 300);
    }, MESSAGE_INTERVAL_MS);
    return () => { if (msgRef.current) clearInterval(msgRef.current); };
  }, []);

  // Aside fade in/out, offset from main rotation
  useEffect(() => {
    const delay = setTimeout(() => {
      setAsideVisible(true);
      asideRef.current = setInterval(() => {
        setAsideVisible(false);
        setTimeout(() => {
          setAsideIndex(i => i + 1);
          setAsideVisible(true);
        }, 400);
      }, ASIDE_INTERVAL_MS);
    }, ASIDE_DELAY_MS);
    return () => {
      clearTimeout(delay);
      if (asideRef.current) clearInterval(asideRef.current);
    };
  }, []);

  const currentMessage = msgIndex < messages.length
    ? messages[msgIndex]
    : FALLBACK_MESSAGE;

  const currentAside = ASIDES[asideIndex % ASIDES.length];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <Loader2
        size={18}
        className="animate-spin"
        style={{ color: warm.colors.accentPetrol }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: warm.colors.textPrimary,
          lineHeight: 1.55,
          maxWidth: 460,
          minHeight: 44,
          opacity: msgVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        {currentMessage}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontStyle: 'italic',
          color: warm.colors.textMuted,
          lineHeight: 1.5,
          maxWidth: 460,
          minHeight: 20,
          opacity: asideVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {currentAside}
      </p>
    </div>
  );
}
