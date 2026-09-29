import React, { useState } from 'react';
import { Flame, Snowflake, Minus, Plus, Check, GraduationCap, Video, Trophy, Clock, Send, MessageSquare } from 'lucide-react';
import { Section, Item, Stage, Spec } from './kit';
import { warm } from '../../lib/theme/warmTokens';
import { Button } from '../../components/shared/Button';
import { StreakHeading } from '../../components/engagement/StreakHeading';
import { TodaysRitual } from '../../components/engagement/TodaysRitual';
import { ApplicationSquares } from '../../components/engagement/ApplicationSquares';
import { DayCounter } from '../../components/engagement/DayCounter';

/* ── 18. The Duolingo direction ────────────────────────────────────────
   A proposal, not shipped. Kiron, 2026-09-29: "make the fonts and stuff a
   bit larger, use Duolingo as a reference". Left is the real component as
   it renders today; right is the proposed treatment of the same content.

   What is borrowed from Duolingo, and what is not:
     - borrowed: a rounded, heavy typeface; text a size larger everywhere;
       chunky controls that press down (a darker bottom edge that the
       button sinks into); thick borders and big radii; numbers as the
       loudest thing in their block.
     - not borrowed: the green, the owl, the cartoon density. The palette
       stays white, blue and gold.

   Nunito stands in for Duolingo's own face (Feather / DIN Round, neither
   free). Loaded only on this page until the direction is agreed.
*/

const D = {
  font: "'Nunito', 'Geist', system-ui, sans-serif",
  blue: warm.colors.accentPetrol,
  blueEdge: '#0B3A85',
  blueSoft: '#EAF1FD',
  gold: '#E5A21C',
  goldEdge: '#B37A0B',
  goldSoft: '#FFF5DE',
  ink: '#1B2433',
  body: '#4B5566',
  muted: '#7D8797',
  line: '#E3E8EF',
  lineEdge: '#CDD5E0',
  green: '#12805C',
  ice: '#1F9BD8',
  iceSoft: '#E4F4FC',
};

const SCALE = {
  display: { fontSize: 40, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.01em' },
  h1: { fontSize: 32, fontWeight: 900, lineHeight: 1.15 },
  h2: { fontSize: 24, fontWeight: 800, lineHeight: 1.25 },
  h3: { fontSize: 19, fontWeight: 800, lineHeight: 1.3 },
  body: { fontSize: 17, fontWeight: 600, lineHeight: 1.55 },
  small: { fontSize: 15, fontWeight: 600, lineHeight: 1.5 },
  label: { fontSize: 13, fontWeight: 800, lineHeight: 1.4, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
};

/** The press-down button: a darker bottom edge the face sinks into. */
function ChunkyButton({
  children, tone = 'blue', size = 'md', full,
}: { children: React.ReactNode; tone?: 'blue' | 'gold' | 'ghost'; size?: 'sm' | 'md'; full?: boolean }) {
  const [down, setDown] = useState(false);
  const face = tone === 'blue' ? D.blue : tone === 'gold' ? D.gold : '#FFFFFF';
  const edge = tone === 'blue' ? D.blueEdge : tone === 'gold' ? D.goldEdge : D.lineEdge;
  const text = tone === 'ghost' ? D.blue : '#FFFFFF';
  const depth = size === 'sm' ? 3 : 4;
  return (
    <button
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        fontFamily: D.font, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
        fontSize: size === 'sm' ? 14 : 16,
        padding: size === 'sm' ? '10px 18px' : '15px 26px',
        width: full ? '100%' : undefined,
        color: text, background: face, cursor: 'pointer',
        border: tone === 'ghost' ? `2px solid ${D.lineEdge}` : 'none',
        borderRadius: 16,
        boxShadow: down ? `0 0 0 ${edge}` : `0 ${depth}px 0 ${edge}`,
        transform: down ? `translateY(${depth}px)` : 'none',
        transition: 'transform 60ms, box-shadow 60ms',
      }}
    >
      {children}
    </button>
  );
}

/** Thick border, big radius, a heavier bottom edge. */
function ChunkyCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', border: `2px solid ${D.line}`, borderBottomWidth: 4,
      borderRadius: 20, padding: 20, fontFamily: D.font, ...style,
    }}>
      {children}
    </div>
  );
}

const noop = () => {};

export function SectionDuolingo() {
  const [target, setTarget] = useState(5);
  const filed = 2;

  return (
    <Section
      n="18"
      title="The Duolingo direction (proposal)"
      lead={<>
        Not built. Asked for on 29 Sep: larger type, Duolingo as the reference. Left is the product today, right is
        the proposal for the same content. Borrowed: a rounded heavy face, everything a size up, controls that press
        down, thick borders, numbers as the loudest thing. Not borrowed: the green or the cartoon density. Palette
        stays white, blue and gold. Press and hold the buttons on the right. Quote a number to change anything.
      </>}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" />

      <Item
        n="18.1"
        title="Type scale"
        labels={['Now', 'Proposed']}
        verdict="Every step about 12% larger, in a rounded face, one weight heavier. Body 15 to 17, small 13 to 15, labels 11 to 13."
        now={
          <Stage>
            <div style={{ fontFamily: warm.type.fontBody, color: warm.colors.textPrimary }}>
              <div style={warm.text.h1}>Keep your 4-day streak</div>
              <div style={{ ...warm.text.h3, marginTop: 10 }}>Today's applications</div>
              <p style={{ ...warm.text.body, color: warm.colors.textSecondary, margin: '8px 0' }}>
                Paste a job ad and we will tell you if it is worth your hour.
              </p>
              <p style={{ ...warm.text.small, color: warm.colors.textMuted, margin: '0 0 8px' }}>Pulled from your target-role list.</p>
              <div style={{ ...warm.text.micro, color: warm.colors.accentPetrol }}>Today's ritual</div>
            </div>
            <Spec>{'h1 26 / h3 16 / body 15 / small 13 / micro 11, Geist'}</Spec>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ fontFamily: D.font, color: D.ink }}>
              <div style={SCALE.h1}>Keep your 4-day streak</div>
              <div style={{ ...SCALE.h3, marginTop: 10 }}>Today's applications</div>
              <p style={{ ...SCALE.body, color: D.body, margin: '8px 0' }}>
                Paste a job ad and we will tell you if it is worth your hour.
              </p>
              <p style={{ ...SCALE.small, color: D.muted, margin: '0 0 8px' }}>Pulled from your target-role list.</p>
              <div style={{ ...SCALE.label, color: D.blue }}>Today's ritual</div>
            </div>
            <Spec>{'h1 32 / h3 19 / body 17 / small 15 / label 13, Nunito 600-900'}</Spec>
          </Stage>
        }
      />

      <Item
        n="18.2"
        title="Buttons"
        labels={['Now', 'Proposed']}
        verdict="Buttons get a darker bottom edge and physically press down, 16px corners, bold uppercase. The ghost button keeps the edge so it still reads as pressable."
        now={
          <Stage>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button label="Check eligibility" onClick={noop} />
              <Button label="Save & continue" variant="secondary" onClick={noop} />
              <Button label="Set" size="sm" onClick={noop} />
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <ChunkyButton>Check eligibility</ChunkyButton>
              <ChunkyButton tone="ghost">Save & continue</ChunkyButton>
              <ChunkyButton size="sm">Set</ChunkyButton>
              <ChunkyButton tone="gold" size="sm">Claim gift</ChunkyButton>
            </div>
          </Stage>
        }
      />

      <Item
        n="18.3"
        title="Top of the dashboard"
        labels={['Now', 'Proposed']}
        stack
        verdict="The streak becomes a big number with a flame, not a sentence. Today's target is a chunky stepper. The squares become chunky tiles you fill. Day 18 of 90 is a progress bar, not a small chip."
        now={
          <Stage>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <StreakHeading streak={4} freezes={1} todayDone={false} floor={5} onBrainClick={noop} />
                <div style={{ marginBottom: 14 }}>
                  <TodaysRitual target={target} filed={filed} locked={false} undoAvailable
                    onTargetChange={setTarget} onSet={noop} onUndo={noop} detail="Pulled from your target-role list." />
                </div>
                <ApplicationSquares filed={filed} target={target} />
              </div>
              <DayCounter day={18} of={90} week={['goal', 'over', 'frozen', 'goal', 'partial', 'future', 'future']} todayIndex={4} />
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ fontFamily: D.font, color: D.ink, display: 'grid', gap: 18 }}>
              {/* Streak + day progress */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
                <ChunkyCard style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Flame size={52} color="#F08A24" fill="#FFB547" strokeWidth={1.8} />
                  <div>
                    <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>4</div>
                    <div style={{ ...SCALE.small, color: D.body }}>day streak. Send 5 today to make it 5.</div>
                  </div>
                  <div style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                    borderRadius: 14, background: D.iceSoft, color: D.ice, fontWeight: 800, fontSize: 15,
                  }}>
                    <Snowflake size={18} /> 1
                  </div>
                </ChunkyCard>
                <ChunkyCard style={{ flex: '1 1 260px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ ...SCALE.h3 }}>Day 18</span>
                    <span style={{ ...SCALE.small, color: D.muted }}>of 90</span>
                  </div>
                  <div style={{ height: 16, borderRadius: 99, background: D.line, marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ width: '20%', height: '100%', background: D.gold, borderRadius: 99,
                      boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.12)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => {
                      const st = ['goal', 'over', 'frozen', 'goal', 'today', 'future', 'future'][i];
                      const bg = st === 'goal' ? D.blue : st === 'over' ? D.gold : st === 'frozen' ? D.iceSoft : '#fff';
                      return (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: st === 'today' ? D.blue : D.muted }}>{l}</div>
                          <div style={{
                            width: 26, height: 26, borderRadius: 99, marginTop: 4, background: bg,
                            border: st === 'today' ? `3px solid ${D.blue}` : st === 'future' ? `2px solid ${D.line}` : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
                          }}>
                            {(st === 'goal' || st === 'over') && <Check size={14} color="#fff" strokeWidth={3.5} />}
                            {st === 'frozen' && <Snowflake size={13} color={D.ice} strokeWidth={2.6} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ChunkyCard>
              </div>

              {/* Today's target + squares */}
              <ChunkyCard>
                <div style={{ ...SCALE.label, color: D.blue }}>Today's goal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ ...SCALE.h2 }}>Apply to</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setTarget(t => Math.max(5, t - 1))} style={{
                      width: 44, height: 44, borderRadius: 14, border: `2px solid ${D.line}`, borderBottomWidth: 4,
                      background: '#fff', color: D.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Minus size={20} strokeWidth={3} /></button>
                    <span style={{ fontSize: 34, fontWeight: 900, minWidth: 36, textAlign: 'center' }}>{target}</span>
                    <button onClick={() => setTarget(t => Math.min(10, t + 1))} style={{
                      width: 44, height: 44, borderRadius: 14, border: `2px solid ${D.line}`, borderBottomWidth: 4,
                      background: '#fff', color: D.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Plus size={20} strokeWidth={3} /></button>
                  </div>
                  <span style={{ ...SCALE.h2 }}>jobs</span>
                  <div style={{ marginLeft: 'auto' }}><ChunkyButton size="sm">Set</ChunkyButton></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  {Array.from({ length: target }, (_, i) => (
                    <div key={i} style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: i < filed ? D.blue : '#fff',
                      border: i < filed ? 'none' : `2px solid ${D.line}`,
                      boxShadow: i < filed ? `0 4px 0 ${D.blueEdge}` : `0 3px 0 ${D.line}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i < filed && <Check size={24} color="#fff" strokeWidth={3.5} />}
                    </div>
                  ))}
                  <span style={{ ...SCALE.h3, color: D.body, marginLeft: 6 }}>{filed} of {target}</span>
                </div>
              </ChunkyCard>
            </div>
          </Stage>
        }
      />

      <Item
        n="18.4"
        title="Tracker numbers"
        labels={['Now', 'Proposed']}
        verdict="The five small uppercase tiles become four cards where the number is the headline, each with its own icon. Rates move under the number in plain words."
        stack
        now={
          <Stage>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 1,
              background: warm.colors.borderWhisper, border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14, overflow: 'hidden',
              fontFamily: warm.type.fontBody,
            }}>
              {[['Saved', 4, warm.colors.textPrimary, ''], ['Applied', 10, warm.colors.accentPetrol, ''],
                ['Interviews', 3, warm.colors.accentGold, '30%'], ['Offers', 1, warm.colors.success, '33%'],
                ['Follow-up due', 2, warm.colors.accentGold, '']].map(([l, v, c, r]) => (
                <div key={l as string} style={{ background: '#fff', padding: '10px 10px' }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.textMuted }}>{l}</p>
                  <p style={{ margin: 0 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</span>{' '}
                    {r && <span style={{ fontSize: 10, color: warm.colors.textMuted, fontWeight: 700 }}>{r}</span>}
                  </p>
                </div>
              ))}
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              {[
                { l: 'Applied', v: 10, sub: 'sent to employers', c: D.blue, bg: D.blueSoft, I: Send },
                { l: 'Interviews', v: 3, sub: '3 in every 10 applications', c: D.goldEdge, bg: D.goldSoft, I: MessageSquare },
                { l: 'Offers', v: 1, sub: '1 from 3 interviews', c: D.green, bg: '#E6F5EF', I: Trophy },
                { l: 'Follow up', v: 2, sub: 'waiting on you', c: '#C2410C', bg: '#FFF0E6', I: Clock },
              ].map(({ l, v, sub, c, bg, I }) => (
                <ChunkyCard key={l} style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 12, background: bg, color: c,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={19} strokeWidth={2.6} /></span>
                    <span style={{ ...SCALE.h3, fontSize: 17 }}>{l}</span>
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, marginTop: 10, color: c }}>{v}</div>
                  <div style={{ ...SCALE.small, fontSize: 14, color: D.muted }}>{sub}</div>
                </ChunkyCard>
              ))}
            </div>
          </Stage>
        }
      />

      <Item
        n="18.5"
        title="A card you tap (Resources)"
        labels={['Now', 'Proposed']}
        verdict="Bigger icon tile, 19px title, the whole card presses down like a button. The 'when to use this' line stays, a size up."
        now={
          <Stage>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, padding: 20, fontFamily: warm.type.fontBody,
              background: '#fff', border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: warm.radius.card, boxShadow: warm.shadow.soft,
            }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: warm.colors.accentPetrolSoft, color: warm.colors.accentPetrol,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GraduationCap size={20} /></span>
              <span>
                <span style={{ display: 'block', ...warm.text.h3, color: warm.colors.textPrimary }}>Classroom</span>
                <span style={{ display: 'block', marginTop: 4, ...warm.text.small, color: warm.colors.textSecondary }}>
                  The full course in eight short modules.
                </span>
                <span style={{ display: 'block', marginTop: 8, fontSize: 12.5, color: warm.colors.textMuted }}>
                  Learning how hiring in Australia actually works
                </span>
              </span>
            </div>
          </Stage>
        }
        next={
          <Stage>
            <div style={{ display: 'grid', gap: 14 }}>
              {[{ I: GraduationCap, t: 'Classroom', b: 'The full course in eight short modules.', c: 'Learning how hiring in Australia works', bg: D.blueSoft, col: D.blue },
                { I: Video, t: 'Video cover letter', b: 'A one-minute video, script written for you.', c: 'Standing out for a role you really want', bg: D.goldSoft, col: D.goldEdge }]
                .map(({ I, t, b, c, bg, col }) => (
                  <ChunkyCard key={t} style={{ display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ width: 60, height: 60, borderRadius: 18, background: bg, color: col, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={30} strokeWidth={2.3} /></span>
                    <span>
                      <span style={{ display: 'block', ...SCALE.h3 }}>{t}</span>
                      <span style={{ display: 'block', ...SCALE.small, color: D.body, marginTop: 2 }}>{b}</span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: D.muted, marginTop: 6 }}>{c}</span>
                    </span>
                  </ChunkyCard>
                ))}
            </div>
          </Stage>
        }
      />
    </Section>
  );
}
