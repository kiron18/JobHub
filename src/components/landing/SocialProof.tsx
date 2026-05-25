import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { colors, type as typeTokens } from './tokens';
import { Eyebrow } from './shared/Eyebrow';

interface CleanCardData {
  quote: string;
  attribution: string;
}

const CARDS: CleanCardData[] = [
  {
    quote: "I have got a job as a Technical BA with TAC. Thank you for your support and assistance in helping me with the process.",
    attribution: 'Jebby Joseph · Technical BA · TAC',
  },
  {
    quote: "The most useful career tool I've ever paid for. And honestly the free diagnostic alone is worth more than half the courses I've taken.",
    attribution: 'Daniel K. · Software Engineer · Sydney',
  },
  {
    quote: "I believe the whole of your diagnostic report really helped throughout my resume editing. It actually counselled, not just mentioned the format, that gave a lot of insight as to why it needed to be done in a certain way. This gave me confidence.",
    attribution: 'Nithya · Data Analyst · Melbourne',
  },
  {
    quote: "It's like having a friend who happens to be a career coach. No fluff. No upsells. Just stuff that actually works in the Australian market.",
    attribution: "Tomás V. · Software Developer · Perth",
  },
  {
    quote: "This is really awesome and helps me to stay focussed. The tracker feature helps me with follow up templates which was very convenient.",
    attribution: 'Diluk Chandrashekar · Project Coordinator · Brisbane',
  },
  {
    quote: "The feedback really helped with a more structured and centered application process, having the right keywords. I have managed to land a fulltime gig.",
    attribution: 'Kunal · Marketing Coordinator · Sydney',
  },
  {
    quote: "I found this tool convenient as it helped me save time. I used it in the morning to send out applications and within 2 months landed a new role, finally in a job I'm proud of. Thank you.",
    attribution: 'Krisheela Bhatia · Administration Officer · Perth',
  },
];

function QuoteCard({ data }: { data: CleanCardData }) {
  return (
    <div
      style={{
        background: colors.bgAlt,
        borderRadius: 16,
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <span
          style={{
            fontFamily: typeTokens.display,
            fontSize: '3rem',
            fontWeight: 500,
            color: colors.accentGold,
            lineHeight: 0.4,
            display: 'block',
            marginBottom: 12,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          &ldquo;
        </span>
        <p
          style={{
            fontFamily: typeTokens.display,
            fontSize: '1.125rem',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.45,
            color: colors.textPrimary,
            margin: 0,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          {data.quote}
        </p>
      </div>
      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: colors.textPrimary,
          margin: '24px 0 0',
        }}
      >
        {data.attribution}
      </p>
    </div>
  );
}

export function SocialProof() {
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, amount: 0.3 });

  return (
    <section id="proof" style={{ background: colors.bgCanvas }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '120px 24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Eyebrow>WHAT GRADUATES ARE WALKING AWAY WITH</Eyebrow>

          <h2
            style={{
              fontFamily: typeTokens.display,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              color: colors.textPrimary,
              margin: 0,
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}
          >
            Real Aussie grads.
            <br />
            Real offers.
          </h2>

        </div>

        <div
          ref={headingRef}
          style={{
            textAlign: 'center',
            marginTop: 48,
            marginBottom: 32,
          }}
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={headingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            style={{
              fontFamily: typeTokens.display,
              fontSize: '1.125rem',
              lineHeight: 1.6,
              fontWeight: 400,
              color: colors.textSecondary,
              maxWidth: 640,
              margin: '16px auto 0',
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}
          >
            Your Australian Job Offer Delivered
          </motion.p>
        </div>

        {/* Job-offers anchor image */}
        <div
          style={{
            marginTop: 32,
            marginBottom: 64,
          }}
        >
          <img
            src="/job-offers.webp"
            alt="Real job offer messages from Australian employers"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxWidth: 800,
              margin: '0 auto',
              maskImage: 'radial-gradient(ellipse at center, black 60%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 60%, transparent 100%)',
            }}
          />
        </div>

        {/* Auto-scrolling marquee */}
        <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)' }}>
          <motion.div
            style={{ display: 'flex', gap: 20, width: 'fit-content' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 90,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          >
            {[...CARDS, ...CARDS].map((card, i) => (
              <div key={i} style={{ flex: '0 0 480px', minWidth: 0 }}>
                <div>
                  <QuoteCard data={card} />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          section#proof > div { padding: 72px 20px; }
        }
      `}</style>
    </section>
  );
}
