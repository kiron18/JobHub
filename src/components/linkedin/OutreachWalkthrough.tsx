import React, { useState, useEffect } from 'react';
import { Eye, ChevronUp, PhoneCall, AlertTriangle } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/* ── The annotated transcript ──────────────────────────────────────────
   Sits above the generator on the Outreach tab. Collapsed by default, but
   loud enough that people want to open it: what the templates below can't
   teach is the SHAPE (message, then call, then follow-up), and especially the two
   places everyone drops it (the ask on the call, and the second follow-up
   weeks later). Reading this once makes every generated draft land better.  */

const LI_BLUE = '#0A66C2';
const SEEN_KEY = 'agc.outreachWalkthrough.seen';

/* People in the worked example. "you" is the member's side of the thread. */
const ROHAN = { initials: 'RS', name: 'Rohan S.', headline: 'MSc Data Science · Melbourne', tint: LI_BLUE };
const ANANYA = { initials: 'AK', name: 'Ananya K.', headline: 'Senior Analyst, Logistics · Sydney', tint: '#2D5A6E' };

function Avatar({ initials, tint, size = 36 }: { initials: string; tint: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: tint, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 700, letterSpacing: '0.02em',
      }}
    >
      {initials}
    </div>
  );
}

/* The gold-railed "why this works" note that follows most beats. */
function Why({ children, label = 'Why this works' }: { children: React.ReactNode; label?: string }) {
  return (
    <div
      style={{
        borderLeft: `2px solid ${warm.colors.accentGold}`,
        background: 'rgba(197,160,89,0.07)',
        borderRadius: '0 8px 8px 0',
        padding: '9px 12px',
        margin: '8px 0 0',
      }}
    >
      <p style={{
        margin: '0 0 3px', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#8A6D2F',
      }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
        {children}
      </p>
    </div>
  );
}

/* A LinkedIn-style message thread. */
function ChatFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: 14, overflow: 'hidden', boxShadow: warm.shadow.soft,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px', background: warm.colors.bgAlt,
        borderBottom: `1px solid ${warm.colors.borderWhisper}`,
      }}>
        <Avatar initials={ANANYA.initials} tint={ANANYA.tint} size={34} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>{ANANYA.name}</p>
          <p style={{
            margin: 0, fontSize: 11.5, color: warm.colors.textMuted,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {ANANYA.headline}
          </p>
        </div>
        <span style={{
          marginLeft: 'auto', flexShrink: 0, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.08em', color: LI_BLUE,
        }}>
          MESSAGING
        </span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Bubble({ from, time, children }: { from: 'you' | 'them'; time: string; children: React.ReactNode }) {
  const mine = from === 'you';
  const person = mine ? ROHAN : ANANYA;
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 8,
      flexDirection: mine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
    }}>
      <Avatar initials={person.initials} tint={person.tint} size={26} />
      <div style={{ maxWidth: '84%' }}>
        <div style={{
          background: mine ? LI_BLUE : warm.colors.bgAlt,
          color: mine ? '#fff' : warm.colors.textPrimary,
          borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding: '10px 13px', fontSize: 13, lineHeight: 1.62,
        }}>
          {children}
        </div>
        <p style={{
          margin: '4px 2px 0', fontSize: 10.5, color: warm.colors.textMuted,
          textAlign: mine ? 'right' : 'left',
        }}>
          {mine ? 'You' : person.name.split(' ')[0]} · {time}
        </p>
      </div>
    </div>
  );
}

function TimeDivider({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 14px' }}>
      <span style={{ flex: 1, height: 1, background: warm.colors.borderWhisper }} />
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: warm.colors.textMuted, whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: warm.colors.borderWhisper }} />
    </div>
  );
}

/* One beat of the call: a timing chip, what you actually say, and why. */
function Beat({ time, title, lines, children }: {
  time: string; title: string; lines: string[]; children?: React.ReactNode;
}) {
  return (
    <div style={{ paddingBottom: 18, marginBottom: 18, borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <span style={{
          flexShrink: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em',
          padding: '3px 8px', borderRadius: 999,
          background: 'rgba(45,90,110,0.10)', color: warm.colors.accentPetrol,
        }}>
          {time}
        </span>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: warm.colors.textPrimary }}>{title}</p>
      </div>
      {lines.map((line, i) => (
        <p key={i} style={{
          margin: i === 0 ? '0 0 6px' : '0 0 6px',
          borderLeft: `2px solid ${LI_BLUE}`,
          background: 'rgba(10,102,194,0.05)',
          borderRadius: '0 8px 8px 0',
          padding: '9px 12px', fontSize: 13, lineHeight: 1.62,
          color: warm.colors.textPrimary,
        }}>
          “{line}”
        </p>
      ))}
      {children}
    </div>
  );
}

function ActHeading({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', margin: '30px 0 14px' }}>
      <span style={{
        flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
        background: warm.colors.accentPetrol, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, fontFamily: warm.type.fontDisplay,
      }}>
        {n}
      </span>
      <div>
        <h4 style={{
          margin: '3px 0 2px', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
          fontFamily: warm.type.fontDisplay, color: warm.colors.textPrimary,
        }}>
          {title}
        </h4>
        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textMuted }}>{sub}</p>
      </div>
    </div>
  );
}

export const OutreachWalkthrough: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true); // assume seen until localStorage says otherwise, so it never flashes

  useEffect(() => {
    try { setSeen(localStorage.getItem(SEEN_KEY) === '1'); } catch { /* private mode: just show it quietly */ }
  }, []);

  function toggle() {
    setOpen(v => {
      if (!v && !seen) {
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* non-blocking */ }
        setSeen(true);
      }
      return !v;
    });
  }

  return (
    <div style={{
      borderRadius: 16, marginBottom: 22, overflow: 'hidden',
      border: `1px solid ${open ? warm.colors.borderWhisper : 'rgba(45,90,110,0.35)'}`,
      background: warm.colors.bgSurface,
      boxShadow: open ? warm.shadow.soft : (seen ? warm.shadow.soft : warm.shadow.lifted),
    }}>
      {/* ── The banner. Dark petrol so it reads as an invitation, not a form ── */}
      <button
        onClick={toggle}
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          border: 'none', padding: '20px 22px',
          background: `linear-gradient(135deg, ${warm.colors.accentPetrol} 0%, ${warm.colors.bgDeep} 100%)`,
          color: warm.colors.textOnDeep, fontFamily: 'inherit',
        }}
      >
        {/* flex-start, not center: the eyebrow wraps to two lines on mobile
            and a vertically-centred icon then floats off the first line. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <Eye size={13} color={warm.colors.accentGold} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: warm.colors.accentGold,
          }}>
            Aussie Grad Careers · Outreach field notes
          </span>
        </div>

        <h3 style={{
          margin: '0 0 8px', fontFamily: warm.type.fontDisplay,
          fontSize: 21, fontWeight: 600, lineHeight: 1.28, letterSpacing: '-0.015em',
          color: '#fff',
        }}>
          Wondering what a successful outreach conversation actually looks like?
        </h3>

        <p style={{
          margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.65,
          color: 'rgba(250,247,242,0.82)', maxWidth: 560,
        }}>
          Spy on a real one, start to finish: the message that got the call, the call itself,
          and the two follow-ups that turned a stranger into a referral. Annotated so you can
          see <em>why</em> every line is there.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 15px', borderRadius: 999,
            background: warm.colors.accentGold, color: '#241B08',
            fontSize: 12.5, fontWeight: 800,
          }}>
            {open ? <ChevronUp size={14} /> : <Eye size={14} />}
            {open ? 'Hide the transcript' : 'Read the transcript'}
          </span>
          <span style={{ fontSize: 11.5, color: 'rgba(250,247,242,0.55)', fontWeight: 600 }}>
            4 min read · Read this before you send anything
          </span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '24px 22px 26px' }}>
          {/* ── The shape ─────────────────────────────────────────── */}
          <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary }}>
            Nearly everyone knows the hidden job market exists. Almost nobody knows the
            <strong style={{ color: warm.colors.textPrimary }}> shape of the conversation </strong>
            that turns a stranger into someone who vouches for them. It's three parts, and the
            third one is where it actually happens.
          </p>

          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {[
              ['1', 'The message', 'Gets you the call. Small ask, easy yes.'],
              ['2', 'The call', 'Builds the relationship. One specific ask at the end.'],
              ['3', 'The follow-up', 'Where referrals are actually born, not on the call itself.'],
            ].map(([n, t, d]) => (
              <div key={n} style={{
                display: 'flex', gap: 10, alignItems: 'center',
                background: warm.colors.bgAlt, borderRadius: 10, padding: '10px 13px',
              }}>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                  background: warm.colors.accentPetrol, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>{n}</span>
                <span style={{ fontSize: 13, color: warm.colors.textSecondary }}>
                  <strong style={{ color: warm.colors.textPrimary }}>{t}.</strong> {d}
                </span>
              </div>
            ))}
          </div>

          {/* ── The two failure modes ─────────────────────────────── */}
          <div style={{
            border: '1px solid rgba(184,92,92,0.22)', background: 'rgba(184,92,92,0.05)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <AlertTriangle size={14} color={warm.colors.danger} />
              <p style={{
                margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: warm.colors.danger,
              }}>
                The two ways people blow this
              </p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.65, color: warm.colors.textSecondary }}>
              <strong style={{ color: warm.colors.textPrimary }}>Hiding your intent until the end.</strong>{' '}
              If you frame the whole thing as “just curious about your work” and only reveal at the
              end that you're job hunting, sharp people notice the switch, and it feels like they
              were used for information. Be upfront early that you're exploring the space. The
              conversation can still be genuinely about learning from them.
            </p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: warm.colors.textSecondary }}>
              <strong style={{ color: warm.colors.textPrimary }}>Ending on a vague ask.</strong>{' '}
              “Let me know if you hear of anything” is forgettable and gives them nothing to do.
              Replace it with something they can act on in ten seconds: a name, a team, an intro.
            </p>
          </div>

          {/* ── Cast ──────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            background: warm.colors.bgAlt, borderRadius: 12, padding: '13px 15px', marginTop: 20,
          }}>
            <Avatar initials={ROHAN.initials} tint={ROHAN.tint} size={38} />
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: warm.colors.textSecondary }}>
              <strong style={{ color: warm.colors.textPrimary }}>The setup.</strong> Rohan just
              finished a Master's in Data Science in Melbourne and wants to break into supply chain
              analytics. He finds Ananya, a Senior Analyst at a logistics company in Sydney, after
              she posts about a demand forecasting project her team shipped.
            </p>
          </div>

          {/* ── ACT 1 ─────────────────────────────────────────────── */}
          <ActHeading n="1" title="The message" sub="One paragraph. One small ask." />

          <ChatFrame>
            <Bubble from="you" time="Tue 9:12 am">
              Hi Ananya, I saw your post about the demand forecasting model your team shipped last
              month, and the part about reworking the seasonality inputs was really interesting. I just
              finished a Master's in Data Science and I'm trying to break into supply chain analytics
              in Australia, so I'm doing a bit of a listening tour with people actually doing the work
              rather than just applying cold. Would you be open to a 15 minute call sometime in the
              next couple of weeks? Happy to work around your schedule.
            </Bubble>
            <Bubble from="them" time="Tue 6:40 pm">
              Hi Rohan! Sure, happy to. Thursday around 4 work for you?
            </Bubble>
          </ChatFrame>

          <Why>
            Three things are doing the work here. It references something{' '}
            <strong>real and specific</strong> (not “great post”). It's{' '}
            <strong>honest about the intent</strong> (“trying to break into supply chain analytics”)
            without making it a job request. And the ask is <strong>15 minutes</strong>, which is
            small enough that saying yes costs her nothing.
          </Why>

          {/* ── ACT 2 ─────────────────────────────────────────────── */}
          <ActHeading n="2" title="The call" sub="15-20 minutes. She should be talking for most of it." />

          <div style={{
            background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14, overflow: 'hidden', boxShadow: warm.shadow.soft,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '11px 14px', background: warm.colors.bgDeep, color: warm.colors.textOnDeep,
            }}>
              <PhoneCall size={14} color={warm.colors.accentGold} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Thursday, 4:00 pm · Google Meet</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(250,247,242,0.55)' }}>18 min</span>
            </div>

            <div style={{ padding: '18px 16px 2px' }}>
              <Beat
                time="1-2 min"
                title="Open by taking the awkwardness off the table"
                lines={['Thanks so much for making time. Before we start, just so you know where I\'m coming from: I\'m not going to ask you for a job today. I\'m genuinely trying to understand how people actually break into this space and what the day-to-day is like. If anything comes up naturally where you think you could point me somewhere, I\'d love that, but that\'s not why I asked for this.']}
              >
                <Why>
                  One line, and you both relax. She stops bracing for the ask; you stop dreading
                  making it. Everything after this is a normal conversation between two people.
                </Why>
              </Beat>

              <Beat
                time="8-10 min"
                title="Her story: you're mostly listening"
                lines={[
                  'How did you end up in supply chain analytics? Was that the plan from the start?',
                  'What does a normal week actually look like for you?',
                  'What\'s the biggest misconception people have about this kind of role before they\'re in it?',
                ]}
              >
                <Why>
                  If you're talking for more than a third of this call, it's gone wrong. People
                  remember the conversations where <em>they</em> did the talking, and they refer
                  the people they remember.
                </Why>
              </Beat>

              <Beat
                time="60-90 sec"
                title="Your background: keep it tight"
                lines={['For context on me, I just finished a Master\'s focused on forecasting and time series work, and I built a couple of projects modelling inventory demand for a retail dataset. I\'m looking to move into an analyst role somewhere in logistics or retail supply chain.']}
              >
                <Why>
                  Short and concrete, on purpose. She can only pass your name to someone if she can
                  repeat what you do in one sentence. Give her that sentence.
                </Why>
              </Beat>

              <Beat
                time="2-3 min"
                title="The ask: a name, not a job"
                lines={['This has been really useful. One thing that would help a lot: is there anyone else you think I should be talking to, either on your team or elsewhere, who\'s working on similar problems? I don\'t want to put you on the spot for a referral to your own company. Even just a name or two of people worth reaching out to would mean a lot.']}
              >
                <Why label="Why this is the whole game">
                  This is the single highest-leverage line in the entire playbook. A referral is a
                  big thing to ask someone who met you 15 minutes ago. <strong>A name is not.</strong>{' '}
                  She can answer it on the spot without spending any of her own credibility, and
                  every name turns one conversation into two. Do this ten times and you have a
                  network, not ten dead ends.
                </Why>
              </Beat>

              <Beat
                time="30 sec"
                title="Close with a promise you'll keep"
                lines={['Thank you again, this genuinely helped me understand the space better. I\'ll send you a quick note after with what I took away.']}
              >
                <Why>
                  Small thing, does a lot: it earns you permission to message her again tomorrow,
                  so step 3 isn't out of the blue.
                </Why>
              </Beat>
            </div>
          </div>

          {/* ── ACT 3 ─────────────────────────────────────────────── */}
          <ActHeading n="3" title="The follow-up" sub="Where most people drop the ball, and where referrals actually come from." />

          <ChatFrame>
            <TimeDivider>Next morning</TimeDivider>
            <Bubble from="you" time="Fri 8:20 am">
              Hi Ananya, thank you again for the call yesterday. The point you made about how the
              forecasting models are only as good as the operations data feeding them really stuck
              with me. Going to read more into that before I keep building my own projects. If you
              do think of anyone worth reaching out to, no rush at all, I really appreciated your
              time either way.
            </Bubble>

            <TimeDivider>Three weeks later · no reply yet</TimeDivider>
            <Bubble from="you" time="Mon 10:05 am">
              Hi Ananya, hope things have been good. Small update on my end: I ended up building a
              forecasting model on a public retail dataset after our chat, mainly inspired by what
              you said about operations data quality. Not asking for anything, just wanted to share
              since you were the reason I went down that path.
            </Bubble>
            <Bubble from="them" time="Mon 1:31 pm">
              This is great, Rohan. Funny timing! We're about to open a junior analyst role. Send
              me your CV and I'll put it in front of my manager.
            </Bubble>
          </ChatFrame>

          <Why label="Why the second message is the one that works">
            The first note is manners. The second one is the referral engine. It arrives weeks
            later, asks for nothing, and proves you actually <em>did</em> something with her advice,
            which is rare enough that it's memorable. Most referrals don't happen on the call. They
            happen the week a role opens up and you're the person she happens to be thinking about.
            Note also that “not asking for anything” is honest here, because Rohan was upfront about
            job hunting in his very first message. Say it without that groundwork and it reads as a
            setup.
          </Why>

          {/* ── Checklist ─────────────────────────────────────────── */}
          <div style={{
            marginTop: 24, background: warm.colors.bgAlt,
            border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 12, padding: '16px 18px',
          }}>
            <p style={{
              margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: warm.colors.accentPetrol,
            }}>
              Sanity check before you send anything
            </p>
            {[
              'Does the message reference something specific and real about them, not a generic compliment?',
              'Am I honest about exploring opportunities, without making the ask about a job?',
              'On the call, are they talking more than I am?',
              'Is my ask specific enough that they could act on it in ten seconds?',
              'Do I have a follow-up ready to send within 24 hours?',
              'Do I have a plan to come back in 3-4 weeks with something I actually did?',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: i === 5 ? 0 : 9 }}>
                <span style={{
                  flexShrink: 0, marginTop: 1, width: 15, height: 15, borderRadius: 4,
                  border: `1.5px solid ${warm.colors.borderDefined}`, background: warm.colors.bgSurface,
                }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.55, color: warm.colors.textSecondary }}>{item}</span>
              </div>
            ))}
          </div>

          {/* ── Tie back to the generator ─────────────────────────── */}
          <div style={{
            marginTop: 18, borderLeft: `3px solid ${warm.colors.accentGold}`,
            background: 'rgba(197,160,89,0.08)', borderRadius: '0 12px 12px 0', padding: '14px 16px',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 700, color: warm.colors.textPrimary }}>
              The shape is what matters, not the exact words.
            </p>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: warm.colors.textSecondary }}>
              Everything the generator below writes for you is a <strong>starting point built on
              this shape</strong>, personalised to you and the person you're reaching out to, but
              still a first draft. Adapt it: swap in your own field, your own city, your own
              projects, your own way of talking. A message in your own voice lands better than a
              polished one that isn't. And when the call comes, come back and reread act two.
            </p>
          </div>

          <button
            onClick={toggle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', marginTop: 18, padding: '10px 0', borderRadius: 10,
              border: `1px solid ${warm.colors.borderDefined}`, background: 'transparent',
              color: warm.colors.textSecondary, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <ChevronUp size={14} />
            Close the transcript
          </button>
        </div>
      )}
    </div>
  );
};
