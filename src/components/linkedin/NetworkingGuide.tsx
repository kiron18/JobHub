import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, DUR, SPRING } from '../../lib/theme/motion';

/* ── The networking guide ──────────────────────────────────────────────
   This replaces three separate blocks that used to sit stacked above the
   generator: an annotated transcript, a strategy summary, and a seven
   step playbook. They repeated each other three times in three voices,
   and the red-railed playbook box read as a warning on a page where
   nothing is wrong.

   One collapsed section now, one voice, told in the order somebody
   actually does it.

   The change of substance is at the front. All three old blocks started
   at "here is how to write the message", and the thing that actually
   stops people is earlier than that: they do not know who to write to.
   So the guide opens with building a list of twenty companies, and the
   messaging comes after, once there is somebody to send it to.
*/

const RULE = warm.colors.borderWhisper;

export function NetworkingGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${open ? warm.colors.borderDefined : RULE}`,
      borderRadius: warm.radius.card,
      marginBottom: 20,
      overflow: 'hidden',
      boxShadow: warm.shadow.soft,
    }}>
      <motion.button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        whileTap={{ scale: 0.995 }}
        transition={SPRING.tap}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 18px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontFamily: warm.type.fontBody,
            ...warm.text.h3, color: warm.colors.textPrimary,
          }}>
            Read this first: how to find the right people, and what to say
          </span>
          <span style={{
            display: 'block', marginTop: 3, fontFamily: warm.type.fontBody,
            ...warm.text.small, color: warm.colors.textMuted,
          }}>
            Six minutes. It starts with the part everyone skips, which is who to message at all.
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: DUR.base, ease: EASE.out }}
          style={{ display: 'inline-flex', color: warm.colors.textMuted, flexShrink: 0 }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="guide"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: DUR.slow, ease: EASE.out },
              opacity: { duration: DUR.base, ease: EASE.out },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 18px 24px', borderTop: `1px solid ${RULE}` }}>
              <GuideBody onClose={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────────────────── */

function Chapter({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 8 }}>
        <span style={{
          fontFamily: warm.type.fontBody, fontSize: 12, fontWeight: warm.weight.bold,
          color: warm.colors.accentPetrol, flexShrink: 0,
        }}>
          {n}
        </span>
        <h4 style={{
          margin: 0, fontFamily: warm.type.fontBody,
          ...warm.text.h3, color: warm.colors.textPrimary,
        }}>
          {title}
        </h4>
      </div>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 11px', fontFamily: warm.type.fontBody,
      fontSize: 14.5, lineHeight: 1.7, color: warm.colors.textSecondary,
    }}>
      {children}
    </p>
  );
}

/** A line that carries the weight of the paragraph it ends. */
function Point({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 11px', fontFamily: warm.type.fontBody,
      fontSize: 14.5, lineHeight: 1.7, fontWeight: warm.weight.semibold,
      color: warm.colors.textPrimary,
    }}>
      {children}
    </p>
  );
}

/** A message, shown as a message, so the shape of it is visible. */
function Message({ from, children }: { from: 'you' | 'them'; children: React.ReactNode }) {
  const mine = from === 'you';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '86%',
        padding: '10px 13px',
        borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: mine ? warm.colors.accentPetrolSoft : warm.colors.bgAlt,
        border: `1px solid ${mine ? 'transparent' : RULE}`,
        fontFamily: warm.type.fontBody, fontSize: 13.5, lineHeight: 1.6,
        color: warm.colors.textPrimary,
      }}>
        {children}
      </div>
    </div>
  );
}

/** The quiet note under a worked example. Never a coloured panel. */
function Why({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '4px 0 0', paddingLeft: 11,
      borderLeft: `2px solid ${warm.colors.borderDefined}`,
      fontFamily: warm.type.fontBody, fontSize: 13, lineHeight: 1.65,
      color: warm.colors.textMuted,
    }}>
      {children}
    </p>
  );
}

function Frame({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '12px 0 14px', padding: '13px 14px',
      background: warm.colors.bgAlt, border: `1px solid ${RULE}`,
      borderRadius: warm.radius.card,
    }}>
      {label && (
        <p style={{
          margin: '0 0 10px', fontFamily: warm.type.fontBody,
          ...warm.text.micro, color: warm.colors.textMuted,
        }}>
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/* ── The guide itself ────────────────────────────────────────────────── */

const COMPANY_EXAMPLE: Array<[string, string]> = [
  ['Kmart Group, Mulgrave', 'Their supply chain team runs one of the biggest forecasting operations in the country, and it is a 25 minute drive from me.'],
  ['Linfox, Essendon Fields', 'Family owned, still growing, and they move freight for half the retailers I buy from.'],
  ['Australia Post, Melbourne CBD', 'Their parcel volumes changed completely after 2020 and I want to see how a network that big adapts.'],
];

function GuideBody({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <Chapter n="01" title="The real problem is not your message">
        <P>
          Almost everyone knows that most jobs get filled through people rather than job boards.
          That is not the part anyone is stuck on.
        </P>
        <P>
          The part people are stuck on is simpler and more embarrassing to admit. They open LinkedIn,
          they sit there, and they have no idea who to message. So they message nobody, or they
          message someone at random and it goes nowhere, and then they decide networking does not
          work for people like them.
        </P>
        <Point>
          So we are going to fix the list before we fix the message.
        </Point>
      </Chapter>

      <Chapter n="02" title="Write down twenty companies">
        <P>
          Not twenty job ads. Twenty companies. Job ads come and go, and a company that has nothing
          open today will have something open in six weeks, at which point you want to already be
          a name they know.
        </P>
        <P>
          Two rules for the list. They should be close enough to you that working there is realistic,
          and they should be in the field you are trying to get into. Beyond that, pick companies you
          are genuinely a bit excited about. Big or small does not matter.
        </P>
        <P>
          Next to each one, write a single sentence: why you would be glad to work there. One line.
          It can be about the work, the products, the scale, the people, anything, as long as it is true.
        </P>
        <Frame label="What the list looks like">
          {COMPANY_EXAMPLE.map(([name, reason]) => (
            <div key={name} style={{ marginBottom: 11 }}>
              <p style={{
                margin: '0 0 2px', fontFamily: warm.type.fontBody,
                fontSize: 13.5, fontWeight: warm.weight.semibold, color: warm.colors.textPrimary,
              }}>
                {name}
              </p>
              <p style={{
                margin: 0, fontFamily: warm.type.fontBody,
                fontSize: 13, lineHeight: 1.6, color: warm.colors.textSecondary,
              }}>
                {reason}
              </p>
            </div>
          ))}
        </Frame>
        <P>
          Twenty is deliberate. One dream company is a lottery ticket and it makes every rejection
          feel final. Twenty is a list you can work through, and it takes the temperature out of any
          single one of them.
        </P>
        <P>
          That one line of reasoning is not a diary entry either. It becomes the opening sentence of
          the message you send, and it is the difference between sounding interested and sounding
          like a form letter.
        </P>
      </Chapter>

      <Chapter n="03" title="Find one person inside each company">
        <P>
          Search the company on LinkedIn and open the People tab. Now filter down to your own field,
          not to the top of the building.
        </P>
        <Point>
          You are not looking for the CEO, and you are not looking for a recruiter.
        </Point>
        <P>
          You are looking for the person whose profile looks like the one you want to have in about
          three years. Close enough to your level that they remember being where you are, senior
          enough that people listen to them.
        </P>
        <P>
          A few things make somebody a good person to reach out to. They have roughly four hundred to
          five hundred connections, which means they still read their messages. They post or comment
          sometimes, which gives you something real to reference. They do the job you want to do.
          And if they came here from somewhere else too, even better, because they have had the exact
          conversation you are about to have.
        </P>
        <P>
          Skip the accounts with thirty thousand followers. Your message will not be read.
        </P>
      </Chapter>

      <Chapter n="04" title="Be slightly familiar before you arrive">
        <P>
          Before you send anything, leave a comment on something they posted. Not "great post". Say
          the specific thing you found interesting, or ask the question their post left you with.
        </P>
        <P>
          It takes a minute and it means your name is not completely cold when your connection
          request turns up.
        </P>
      </Chapter>

      <Chapter n="05" title="The connection note">
        <P>
          Keep it under two hundred characters, which is what LinkedIn allows on a free account.
          Reference something real. Do not put an ask in it. The connection request is already an ask,
          and stacking a second one on top is what gets it ignored.
        </P>
      </Chapter>

      <Chapter n="06" title="The message that gets you the call">
        <P>
          Once they accept, send this. Say plainly what you are moving into, and ask for the fifteen
          minutes in the same breath. Do not hide the reason you are there and spring it three
          messages later. People can feel that coming and it costs you the goodwill you just built.
        </P>
        <Frame label="What it looks like">
          <Message from="you">
            Hi Ananya, I saw your post about the demand forecasting model your team shipped last month,
            and the part about reworking the seasonality inputs was really interesting. I just finished
            a Master's in Data Science and I am trying to break into supply chain analytics. Would you
            be open to a 15 minute chat about how you got into it?
          </Message>
          <Message from="them">
            Hi Rohan! Sure, happy to. Thursday around 4 work for you?
          </Message>
          <Why>
            It opens with something only this person could have received. It says what he wants
            without turning it into a job request. And fifteen minutes is small enough that saying
            yes costs her nothing.
          </Why>
        </Frame>
      </Chapter>

      <Chapter n="07" title="The call">
        <P>
          Open by taking the pressure off. One line: "I am not here to ask you for a job, I just
          wanted to hear how you got into this." She stops bracing for the ask, you stop dreading
          making it, and everything after that is two people having a normal conversation.
        </P>
        <P>
          Bring three specific questions. Then talk less than a third of the time. People remember
          the conversations where they did the talking, and they refer the people they remember.
        </P>
        <P>
          When she asks what you are working on, have one short answer ready. She can only pass your
          name on if she can repeat what you do in a single sentence, so give her that sentence.
        </P>
        <Point>
          Close by asking for a name, not a referral.
        </Point>
        <P>
          "Is there anyone else you think I should talk to?" is easy to say yes to. A referral is a
          big thing to ask of someone who met you fifteen minutes ago, and asking for it now is the
          most common way this gets thrown away.
        </P>
      </Chapter>

      <Chapter n="08" title="The two follow-ups, and where referrals actually come from">
        <P>
          Within a day, send a thank you that names the one thing that stuck with you. It is manners,
          and it earns you permission to message her again later.
        </P>
        <P>
          Then, three or four weeks on, send the second one. This is the one that works. You tell her
          what you actually did off the back of her advice, and you ask for nothing at all.
        </P>
        <Frame label="Three weeks later">
          <Message from="you">
            Hi Ananya, hope things have been good. Small update on my end: I ended up building a
            forecasting model on a public retail dataset after our chat, mainly inspired by what you
            said about operations data quality. Not asking for anything, just wanted to share since
            it came out of your advice.
          </Message>
          <Message from="them">
            This is great, Rohan. Funny timing. We are about to open a junior analyst role. Send me
            your CV and I will put it in front of my manager.
          </Message>
          <Why>
            Almost nobody does this, which is exactly why it is memorable. Most referrals do not
            happen on the call. They happen weeks later, in the week a role opens up, and they go to
            whoever the person happens to be thinking about.
          </Why>
        </Frame>
      </Chapter>

      <Chapter n="09" title="Now use the generator below">
        <P>
          Everything above is the shape. The tool underneath writes the drafts so you are not staring
          at an empty box for twenty companies in a row.
        </P>
        <P>
          Take one company off your list, take the person you found inside it, and fill in the four
          fields. Here is that same example, filled in:
        </P>
        <Frame label="Filled in, using the example above">
          <div style={{ display: 'grid', gap: 9 }}>
            <MockField label="First name" value="Ananya" />
            <MockField label="Company" value="Linfox" />
            <MockField label="What they work on or posted about" value="demand forecasting, reworking seasonality inputs" />
            <MockField label="A specific question you want to ask" value="How did you move from analytics into supply chain?" />
          </div>
          <p style={{
            margin: '13px 0 0', fontFamily: warm.type.fontBody,
            fontSize: 13, lineHeight: 1.65, color: warm.colors.textSecondary,
          }}>
            Press generate and you get five drafts back: the connection note, the message that asks
            for the call, the thank you, a second run at the ask if the first one went quiet, and the
            three week follow-up.
          </p>
        </Frame>
        <P>
          Change them. Put your own field in, your own city, your own projects, your own way of
          talking. A message in your own voice lands better than a polished one that is not yours,
          and the person on the other end can tell the difference.
        </P>
        <Point>
          Stay curious and keep it light. This is not a transaction, it is a conversation with
          somebody who does the job you want. The career part is a by-product of that.
        </Point>

        <button
          onClick={onClose}
          style={{
            marginTop: 16, background: 'none', border: 'none', padding: '6px 0',
            fontFamily: warm.type.fontBody, fontSize: 13.5,
            fontWeight: warm.weight.semibold, color: warm.colors.accentPetrol,
            cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4,
          }}
        >
          Close the guide and start
        </button>
      </Chapter>
    </div>
  );
}

/** A field as it would look filled in. Not a real input: this is a picture. */
function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{
        display: 'block', marginBottom: 4,
        fontFamily: warm.type.fontBody, fontSize: 11.5,
        fontWeight: warm.weight.semibold, color: warm.colors.textMuted,
      }}>
        {label}
      </span>
      <span style={{
        display: 'block', padding: '8px 11px',
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderDefined}`,
        borderRadius: warm.radius.input,
        fontFamily: warm.type.fontBody, fontSize: 13.5,
        color: warm.colors.textPrimary,
      }}>
        {value}
      </span>
    </div>
  );
}
