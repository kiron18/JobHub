import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, Check } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';

/* ── EditGlowButton ────────────────────────────────────────────────────
   The Edit toggle on a generated document, and the one way to change it.

   Regenerate is gone from a finished draft (Kiron, 2026-09-29): a whole new
   draft throws away what was right along with what was wrong, and it is
   slower. A surgical edit keeps the good lines and is where the document
   becomes the person's own.

   So Edit has to be impossible to miss. Until someone has used it once, the
   border shimmers blue and gold; after that it is a plain button, because a
   control that glows forever stops meaning anything. The first draft anyone
   ever sees also gets a small pop-up next to it saying why.

   Both memories are per browser (localStorage). Losing them costs one extra
   shimmer and one extra pop-up, nothing more.
*/

const USED_KEY = 'jobhub_edit_used';
const INTRO_KEY = 'jobhub_edit_intro_seen';

const read = (k: string) => { try { return localStorage.getItem(k) === 'true'; } catch { return false; } };
const write = (k: string) => { try { localStorage.setItem(k, 'true'); } catch { /* private window */ } };

const CSS = `
@keyframes jh-edit-sheen { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes jh-edit-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,144,26,0.0), 0 0 10px 1px rgba(18,87,196,0.28); }
                           50% { box-shadow: 0 0 0 3px rgba(201,144,26,0.14), 0 0 18px 3px rgba(201,144,26,0.40); } }
`;

export interface EditGlowButtonProps {
  editing: boolean;
  onToggle: () => void;
  /** Which document, for the pop-up copy. */
  docLabel: string;
}

export function EditGlowButton({ editing, onToggle, docLabel }: EditGlowButtonProps) {
  const reduced = prefersReducedMotion();
  const [used, setUsed] = useState(() => read(USED_KEY));
  const [introOpen, setIntroOpen] = useState(false);

  // Only ever once, the first time a finished draft is on screen.
  useEffect(() => {
    if (read(INTRO_KEY)) return;
    const t = setTimeout(() => setIntroOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  const closeIntro = () => { write(INTRO_KEY); setIntroOpen(false); };

  const click = () => {
    if (!used) { write(USED_KEY); setUsed(true); }
    if (introOpen) closeIntro();
    onToggle();
  };

  const glow = !used && !editing;

  return (
    <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <style>{CSS}</style>
      <span
        style={{
          display: 'inline-flex', padding: glow ? 2 : 0, borderRadius: 999,
          background: glow
            ? `linear-gradient(90deg, ${warm.colors.accentPetrol}, ${warm.colors.accentGoldBright}, #7FB2FF, ${warm.colors.accentPetrol})`
            : 'transparent',
          backgroundSize: '200% 100%',
          animation: glow && !reduced ? 'jh-edit-sheen 2.6s linear infinite, jh-edit-pulse 2.2s ease-in-out infinite' : undefined,
        }}
      >
        <button
          onClick={click}
          title={editing ? 'Save your edits' : `Edit the ${docLabel} directly`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
            fontFamily: warm.type.fontBody, fontSize: 13.5, fontWeight: 700,
            background: editing ? warm.colors.accentGold : '#FFFFFF',
            color: editing ? '#FFFFFF' : warm.colors.accentPetrol,
            border: glow ? 'none' : `1.5px solid ${editing ? warm.colors.accentGold : warm.colors.borderDefined}`,
          }}
        >
          {editing ? <Check size={14} strokeWidth={2.6} /> : <PenLine size={14} strokeWidth={2.4} />}
          {editing ? 'Done' : 'Edit'}
        </button>
      </span>

      <AnimatePresence>
        {introOpen && !editing && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            role="dialog"
            aria-label="How to change this document"
            style={{
              marginTop: 10, width: 290, maxWidth: 'calc(100vw - 72px)', padding: '16px 16px 14px', borderRadius: 14,
              background: '#FFFFFF', border: `1px solid ${warm.colors.borderDefined}`,
              boxShadow: warm.shadow.lifted, fontFamily: warm.type.fontBody, position: 'relative',
            }}
          >
            {/* The little arrow up to the button. */}
            <span style={{
              position: 'absolute', top: -7, right: 28, width: 12, height: 12, background: '#FFFFFF',
              borderLeft: `1px solid ${warm.colors.borderDefined}`, borderTop: `1px solid ${warm.colors.borderDefined}`,
              transform: 'rotate(45deg)',
            }} />
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>
              Make it yours with Edit
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5, color: warm.colors.textSecondary }}>
              Change a word, a number or a line right here. Small, surgical edits are faster than a new
              draft, and they are what make this {docLabel} truly yours.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={closeIntro}
                style={{
                  padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'transparent', color: warm.colors.textSecondary, border: `1px solid ${warm.colors.borderWhisper}`,
                }}
              >
                Got it
              </button>
              <button
                onClick={click}
                style={{
                  padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: warm.colors.accentPetrol, color: '#FFFFFF', border: 'none',
                }}
              >
                Start editing
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
