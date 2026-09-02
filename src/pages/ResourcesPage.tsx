import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ShieldCheck, Building2, HeartHandshake, ArrowRight } from 'lucide-react';
import { warm } from '../lib/theme/warmTokens';
import { rise, stagger, SPRING, t, DUR } from '../lib/theme/motion';

/* ── Resources ─────────────────────────────────────────────────────────
   Four things that used to sit in the sidebar as equals to Applications
   and Your profile, which is the wrong weight for them: these are the
   pages you open twice a month, not twice a day.

   They are still four separate pages, because they already work and
   nothing is gained by rebuilding them into one scroll. This is the door
   they share.
*/

interface Resource {
  to: string;
  icon: typeof Mail;
  title: string;
  body: string;
  /** What you would actually be here to do. Concrete, not a category. */
  cue: string;
}

const RESOURCES: Resource[] = [
  {
    to: '/email-templates',
    icon: Mail,
    title: 'Templates',
    body: 'Written and ready. Pick the situation, copy it, fill in the two blanks and send.',
    cue: 'Chasing a recruiter who has gone quiet',
  },
  {
    to: '/visa-sponsors',
    icon: ShieldCheck,
    title: 'Visa sponsors',
    body: 'Every business the Australian Government has approved to sponsor a work visa, straight from the Home Affairs list.',
    cue: 'Checking whether a company can sponsor you before you spend an hour applying',
  },
  {
    to: '/local-experience-playbook',
    icon: Building2,
    title: 'Local experience',
    body: 'Six routes to Australian experience when every ad wants it and nobody will give you the first one.',
    cue: 'Working out what to do about the experience catch-22',
  },
  {
    to: '/mindset',
    icon: HeartHandshake,
    title: 'Mindset',
    body: 'For the stretches where nothing is landing and the silence starts to feel personal.',
    cue: 'Three weeks of no replies',
  },
];

export default function ResourcesPage() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 26 }}>
        <h1 style={{
          margin: '0 0 6px', fontFamily: warm.type.fontBody,
          ...warm.text.h1, color: warm.colors.textPrimary,
        }}>
          Resources
        </h1>
        <p style={{
          margin: 0, fontFamily: warm.type.fontBody,
          ...warm.text.body, color: warm.colors.textSecondary,
        }}>
          The things you come back to rather than work in.
        </p>
      </header>

      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        style={{ display: 'grid', gap: 12 }}
      >
        {RESOURCES.map(r => {
          const Icon = r.icon;
          return (
            <motion.button
              key={r.to}
              variants={rise}
              onClick={() => navigate(r.to)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.995 }}
              transition={SPRING.tap}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: 20,
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: warm.radius.card,
                boxShadow: warm.shadow.soft,
                transition: t(['border-color', 'box-shadow'], DUR.base),
              }}
            >
              <span style={{
                width: 42, height: 42, flexShrink: 0, borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: warm.colors.accentPetrolSoft,
                color: warm.colors.accentPetrol,
              }}>
                <Icon size={20} strokeWidth={1.9} />
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', fontFamily: warm.type.fontBody,
                  ...warm.text.h3, color: warm.colors.textPrimary,
                }}>
                  {r.title}
                </span>
                <span style={{
                  display: 'block', marginTop: 4,
                  fontFamily: warm.type.fontBody, ...warm.text.small,
                  color: warm.colors.textSecondary,
                }}>
                  {r.body}
                </span>
                {/* The cue, not a category. "Visa sponsors" tells you the
                    subject; "before you spend an hour applying" tells you when
                    to come here, which is the part people cannot guess. */}
                <span style={{
                  display: 'block', marginTop: 8,
                  fontFamily: warm.type.fontBody, fontSize: 12.5,
                  color: warm.colors.textMuted,
                }}>
                  {r.cue}
                </span>
              </span>

              <span style={{ color: warm.colors.textMuted, flexShrink: 0, marginTop: 12 }}>
                <ArrowRight size={16} />
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
