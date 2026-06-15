/**
 * ResumeScanAnimation — Lottie-driven 6-second resume scan visualizer.
 *
 * Shows 3 resumes cycling past with a squiggly paper effect, wobble animation,
 * and Disney exit principles. Resume text is rendered as DOM overlays (Fraunces
 * font) so it's crisp and readable. The Lottie handles the paper outline,
 * shadow, doodle marks, wobble, and exit animation.
 *
 * When complete, fires onComplete callback.
 */
import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Data: 3 resumes with realistic content
// ---------------------------------------------------------------------------
interface ResumeData {
  name: string;
  role: string;
  education: string;
  school: string;
  experience: { title: string; company: string; bullets: string[] };
  skills: string;
}

const RESUMES: ResumeData[] = [
  {
    name: 'Sarah Chen',
    role: 'Junior Software Engineer',
    education: 'B.S. Computer Science',
    school: 'University of Sydney',
    experience: {
      title: 'Junior Developer',
      company: 'TechStart Pty Ltd',
      bullets: [
        'Built and maintained React components for the customer-facing dashboard',
        'Collaborated with designers to implement responsive layouts',
        'Wrote unit tests using Jest and React Testing Library',
      ],
    },
    skills: 'React, TypeScript, Node.js, Jest, Git, Figma',
  },
  {
    name: 'Marcus Johnson',
    role: 'Product Manager',
    education: 'MBA',
    school: 'Melbourne Business School',
    experience: {
      title: 'Associate Product Manager',
      company: 'FinServe Australia',
      bullets: [
        'Led cross-functional team of 8 to deliver 3 major platform releases',
        'Defined product roadmap based on user research and data analysis',
        'Managed stakeholder expectations across engineering, design, and sales',
      ],
    },
    skills: 'Product Strategy, Roadmapping, Agile, SQL, User Research, Jira',
  },
  {
    name: 'Priya Patel',
    role: 'Data Analyst',
    education: 'B.S. Statistics',
    school: 'University of New South Wales',
    experience: {
      title: 'Junior Data Analyst',
      company: 'DataViz Solutions',
      bullets: [
        'Created dashboards and reports using Tableau and Power BI',
        'Cleaned and processed datasets for analysis using Python and SQL',
        'Presented findings to non-technical stakeholders in weekly reviews',
      ],
    },
    skills: 'Python, SQL, Tableau, Excel, Statistics, Data Visualisation',
  },
];

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const TOTAL_RESUMES = 3;
const MS_PER_RESUME = 2200;

type Phase = 'loading' | 'playing' | 'complete';

interface Props {
  onComplete: () => void;
}

export function ResumeScanAnimation({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [countdown, setCountdown] = useState(6);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [showResume, setShowResume] = useState(true);

  const resume = currentIdx < TOTAL_RESUMES ? RESUMES[currentIdx] : RESUMES[0];

  // -----------------------------------------------------------------------
  // Load and play the Lottie animation
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    let tickTimeout: ReturnType<typeof setTimeout> | null = null;
    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
    let ended = false;

    fetch('/Assets/resume-scan-animation.json')
      .then(res => res.json())
      .then(animationData => {
        if (!containerRef.current) return;

        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData,
        });
        animRef.current = anim;
        setPhase('playing');

        // ---- Resume 1 ----
        setCurrentIdx(0);
        setVisibleIdx(0);
        setShowResume(true);
        setCountdown(6);
        anim.goToAndPlay(0, false);

        // Countdown ticker for Resume 1
        let pos = 0;
        const DIGIT_MS = MS_PER_RESUME / 7;
        tickTimeout = setTimeout(function tick() {
          if (ended) return;
          pos++;
          if (pos < 7) setCountdown(prev => Math.max(prev - 1, 0));
          if (pos < 7) tickTimeout = setTimeout(tick, DIGIT_MS);
        }, DIGIT_MS);

        // Advance to Resume 2 at ~2.2s
        resumeTimeout = setTimeout(() => {
          if (ended) return;
          setCurrentIdx(1);
          setVisibleIdx(1);
          setCountdown(6);
          // Lottie auto-plays from frame 110 onward (exit+entry)

          pos = 0;
          tickTimeout = setTimeout(function tick2() {
            if (ended) return;
            pos++;
            if (pos < 7) setCountdown(prev => Math.max(prev - 1, 0));
            if (pos < 7) tickTimeout = setTimeout(tick2, DIGIT_MS);
          }, DIGIT_MS);
        }, MS_PER_RESUME);
      })
      .catch(err => {
        console.error('Failed to load resume scan animation:', err);
        setPhase('complete');
        onComplete();
      });

    return () => {
      ended = true;
      if (tickTimeout) clearTimeout(tickTimeout);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [onComplete]);

  // -----------------------------------------------------------------------
  // Handle Resume 2 -> Resume 3 transition
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (currentIdx !== 1 || phase !== 'playing') return;

    const DIGIT_MS = MS_PER_RESUME / 7;
    let pos = 0;
    let ended = false;

    const tickTimeout = setTimeout(function tick2() {
      if (ended) return;
      pos++;
      if (pos < 7) setCountdown(prev => Math.max(prev - 1, 0));
      if (pos < 7) setTimeout(tick2, DIGIT_MS);
    }, DIGIT_MS);

    const resumeTimeout = setTimeout(() => {
      if (ended) return;
      setCurrentIdx(2);
      setVisibleIdx(2);
      setCountdown(6);

      pos = 0;
      const tickTimeout3 = setTimeout(function tick3() {
        if (ended) return;
        pos++;
        if (pos < 7) setCountdown(prev => Math.max(prev - 1, 0));
        if (pos < 7) setTimeout(tick3, DIGIT_MS);
      }, DIGIT_MS);

      const endTimeout = setTimeout(() => {
        if (ended) return;
        setCountdown(0);
        setTimeout(() => {
          if (!ended) {
            setPhase('complete');
            setShowResume(false);
            onComplete();
          }
        }, 1400);
      }, MS_PER_RESUME + 200);

      return () => {
        ended = true;
        clearTimeout(tickTimeout3);
        clearTimeout(endTimeout);
      };
    }, MS_PER_RESUME + 200);

    return () => {
      ended = true;
      clearTimeout(tickTimeout);
      clearTimeout(resumeTimeout);
    };
  }, [currentIdx, phase, onComplete]);

  // -----------------------------------------------------------------------
  // Resume 3 — final countdown and exit
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (currentIdx !== 2 || phase !== 'playing') return;

    const DIGIT_MS = MS_PER_RESUME / 7;
    let pos = 0;
    let ended = false;

    const tickTimeout = setTimeout(function tick() {
      if (ended) return;
      pos++;
      if (pos < 7) setCountdown(prev => Math.max(prev - 1, 0));
      if (pos < 7) setTimeout(tick, DIGIT_MS);
    }, DIGIT_MS);

    const endTimeout = setTimeout(() => {
      if (ended) return;
      setCountdown(0);
      setTimeout(() => {
        if (!ended) {
          setPhase('complete');
          setShowResume(false);
          onComplete();
        }
      }, 1400);
    }, MS_PER_RESUME + 200);

    return () => {
      ended = true;
      clearTimeout(tickTimeout);
      clearTimeout(endTimeout);
    };
  }, [currentIdx, phase, onComplete]);

  if (phase === 'complete') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          aspectRatio: '1 / 1',
          position: 'relative',
        }}
      >
        {/* Lottie paper outline + wobble */}
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        />

        {/* Resume text — pinned to the paper area */}
        <AnimatePresence mode="wait">
          {showResume && (
            <motion.div
              key={`resume-${visibleIdx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                left: '21.5%',
                top: '5%',
                right: '21.5%',
                bottom: '17%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6%',
                overflow: 'hidden',
              }}
            >
              {/* Name */}
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  fontSize: 'clamp(11px, 1.5vw, 18px)',
                  color: '#111',
                  lineHeight: 1.15,
                  marginTop: '1%',
                }}
              >
                {resume.name}
              </span>
              {/* Role */}
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(8px, 1.1vw, 13px)',
                  color: '#555',
                  lineHeight: 1.2,
                }}
              >
                {resume.role}
              </span>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: '#ccc',
                  margin: '2% 0',
                  width: '100%',
                }}
              />

              {/* Education */}
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  fontSize: 'clamp(7px, 0.9vw, 11px)',
                  color: '#333',
                  lineHeight: 1.2,
                }}
              >
                {resume.education}
              </span>
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(6.5px, 0.85vw, 10px)',
                  color: '#666',
                  lineHeight: 1.3,
                  marginBottom: '2%',
                }}
              >
                {resume.school}
              </span>

              {/* Experience */}
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  fontSize: 'clamp(7px, 0.9vw, 11px)',
                  color: '#333',
                  lineHeight: 1.2,
                }}
              >
                {resume.experience.title}
              </span>
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(6.5px, 0.85vw, 10px)',
                  color: '#666',
                  lineHeight: 1.3,
                  marginBottom: '1%',
                }}
              >
                {resume.experience.company}
              </span>

              {/* Bullets */}
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '5%',
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4%',
                }}
              >
                {resume.experience.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(5.5px, 0.7vw, 9px)',
                      color: '#444',
                      lineHeight: 1.35,
                      position: 'relative',
                      paddingLeft: '4%',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, top: 0 }}>{'•'}</span>
                    {b}
                  </li>
                ))}
              </ul>

              {/* Skills */}
              <div
                style={{
                  marginTop: '2%',
                  paddingTop: '1.5%',
                  borderTop: '1px solid #ddd',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 600,
                    fontSize: 'clamp(6px, 0.75vw, 9px)',
                    color: '#333',
                    lineHeight: 1.3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Skills
                </span>
                <span
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(5.5px, 0.7vw, 8.5px)',
                    color: '#555',
                    lineHeight: 1.3,
                    display: 'block',
                    marginTop: '0.5%',
                  }}
                >
                  {resume.skills}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom overlay: countdown + indicators */}
        <div
          style={{
            position: 'absolute',
            bottom: '3%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Countdown timer — Fraunces display */}
          <AnimatePresence mode="wait">
            <motion.span
              key={`cd-${visibleIdx}-${countdown}`}
              initial={{ opacity: 0, y: 5, scale: 0.92, filter: 'blur(1.5px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -5, scale: 1.06, filter: 'blur(1px)' }}
              transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 900,
                fontSize: 'clamp(22px, 4vw, 40px)',
                color: '#c0392b',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
                lineHeight: 1,
                textShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              00:
              {String(countdown).padStart(2, '0')}
            </motion.span>
          </AnimatePresence>

          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 400,
              fontSize: 'clamp(8px, 1vw, 11px)',
              color: 'rgba(0,0,0,0.3)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            SECONDS PER RESUME
          </span>

          <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: i === visibleIdx ? '#2D5A6E' : 'rgba(0,0,0,0.1)',
                  transition: 'background 300ms ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
