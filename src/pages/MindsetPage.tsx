/**
 * Mindset — a quiet resource for the hard stretches of a job hunt.
 *
 * Linked from the footer of every dashboard page as "Dealing with silence?
 * Quick-ref mindset tips →". Static page, no tracking, no chatbot. Copy
 * lives in this file so changes are reviewable in git.
 *
 * Voice rule: calm, direct, no exclamation marks, no "you've got this!"
 * energy. If a section reads like a wellness blog or a LinkedIn post,
 * rewrite it toward "letter from a friend who has seen this before."
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppTheme } from '../contexts/ThemeContext';

interface Section {
  heading: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "Silence isn't rejection.",
    body: [
      'Most silence after an application is not personal and not a verdict.',
      "The role gets frozen. Internal candidates emerge. The recruiter goes on leave. A hiring manager changes priorities. A reorg quietly kills the headcount. None of those reach you as an email. They just look like no reply.",
      "If you've sent the application and followed up once, you've done your part. The next move belongs to them. Don't fill the silence with stories about what you did wrong.",
    ],
  },
  {
    heading: "You're not behind.",
    body: [
      "Time-to-offer for international graduates in Australia varies wildly. Three weeks for some roles. Eight months for others. The median is somewhere around four months, and that figure hides everyone who paused, changed direction, or took an interim role on the way through.",
      "Your timeline is not the average and the average is not a deadline.",
      "If you are still applying, still tightening your profile, still showing up, you are not behind. You are in the middle of a process that was always going to take time.",
    ],
  },
  {
    heading: "What to do when nothing is moving.",
    body: [
      'When the pipeline is silent and the calendar feels heavy, pick three things and stop there:',
      "1. Tighten one application you've already sent. Refine the cover letter, sharpen one bullet. Quality work on something you've already produced.",
      '2. Send one short message to a former colleague, a connection two roles deep, or someone you admire. Not asking for a job. Asking a single, specific question.',
      '3. Take a real rest day. Not a guilt-rest. A planned one.',
      "The temptation in dead weeks is to apply to more roles. That rarely changes the outcome. Sharpening one thing, talking to one person, and resting properly will move you further than another twenty applications you don't believe in.",
    ],
  },
  {
    heading: 'When to step back.',
    body: [
      'There are signs that the hunt has shifted from work to compulsion:',
      "• You're applying to roles you wouldn't take.",
      "• You can't remember which company you've spoken to.",
      "• The first thing you do in the morning is check email for replies that aren't there.",
      "• You're being short with the people you live with.",
      'When you notice two or more, the right move is to stop for two or three days. Not to push through. The cost of stopping is small. The cost of burning out mid-search is months.',
      'Stepping back is part of the process, not a failure of it.',
    ],
  },
  {
    heading: 'On rejection emails.',
    body: [
      'Most rejection emails say very little. "We\'ve decided to progress with other candidates." That is the whole sentence.',
      "What it does not say: that you weren't qualified, that you weren't a good candidate, that there was something visibly wrong. It says one thing only. That this company, on this day, went with someone else.",
      "You will not get a real reason. Asking is fine but rarely productive. The most useful thing you can do with a rejection is write down one line about it: what you learned, what you'd frame differently next time, and then move on. You can save the line in your tracker. Over months, those lines become a real record of what's working and what isn't.",
    ],
  },
  {
    heading: 'A note on visa stress.',
    body: [
      'If your visa is tied to your search, your urgency is real and not in your head. The deadline pressure is structural, not psychological.',
      'Two things worth saying. First: panic narrows your thinking. The roles you can see when you\'re stressed are a smaller subset than the roles that actually exist. Second: visa advice is specialist work. We are not migration agents. If your situation is changing, talk to a registered migration agent before you make decisions you can\'t reverse.',
      'You can carry the stress without letting it drive every choice.',
    ],
  },
  {
    heading: "You've already done the hard part.",
    body: [
      "You moved countries. You built a profile in a system that didn't know you. You're doing a job hunt in a market that has its own conventions and you're learning them in real time.",
      "The fact that you're still pushing on means most of the hard work is behind you, not ahead. The role you land won't feel like a reward for that work. It'll just feel like a Tuesday, like any other start date.",
      'What you\'ve done to get here is the part that counts. Whatever comes next is the easier half.',
    ],
  },
];

export function MindsetPage() {
  const { T } = useAppTheme();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 4px 80px' }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: T.textMuted,
          textDecoration: 'none',
          marginBottom: 32,
          transition: 'color 200ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
        onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>

      <h1 style={{
        margin: '0 0 16px',
        fontSize: 28,
        fontWeight: 700,
        color: T.text,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      }}>
        A few notes for the hard stretches.
      </h1>
      <p style={{ margin: '0 0 8px', fontSize: 15, color: T.textMuted, lineHeight: 1.65 }}>
        This page is not advice. It is a set of quiet reminders, written for the days when the silence is loud.
      </p>
      <p style={{ margin: '0 0 48px', fontSize: 15, color: T.textMuted, lineHeight: 1.65 }}>
        You can leave it open in a tab. You can come back to it. Nothing on it will change.
      </p>

      {SECTIONS.map((section, idx) => (
        <section key={idx} style={{ marginBottom: 40 }}>
          <h2 style={{
            margin: '0 0 14px',
            fontSize: 18,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '-0.01em',
          }}>
            {idx + 1}. {section.heading}
          </h2>
          {section.body.map((para, pIdx) => (
            <p key={pIdx} style={{
              margin: '0 0 12px',
              fontSize: 14,
              color: T.textMuted,
              lineHeight: 1.75,
            }}>
              {para}
            </p>
          ))}
        </section>
      ))}

      <footer style={{
        marginTop: 56,
        paddingTop: 24,
        borderTop: `1px solid ${T.cardBorder}`,
        fontSize: 12,
        color: T.textFaint,
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        This page does not track you. Nothing on it changes. Bookmark it if it helps.
      </footer>
    </div>
  );
}
