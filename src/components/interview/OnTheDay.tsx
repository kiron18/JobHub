import { warm } from '../../lib/theme/warmTokens';

const ITEMS: { label: string; body: string }[] = [
    {
        label: 'Dress',
        body: 'Polished, considered, professional. Dress at the level of the role you are stepping into, not the environment you expect to find.',
    },
    {
        label: 'Arrive',
        body: 'Ten minutes early, minimum. Use the time to read your notes calmly, not to take in new information. Your preparation is done. Breathe.',
    },
    {
        label: 'The pause',
        body: 'After every question, take one breath before you begin. Non-negotiable, even when the answer is immediate. It signals composure and precision.',
    },
    {
        label: 'Eye contact',
        body: 'Sustained, warm, direct. You are speaking to people, not delivering a presentation. Engage everyone in the room, not only whoever asked the question.',
    },
    {
        label: 'First sentence',
        body: 'Open every answer with a sentence that frames what it is about, then go into the story. "In my time at that organisation, I led a piece of work that maps directly to this."',
    },
    {
        label: 'The smile',
        body: 'A genuine smile at the start, when you agree with something they say, and at the close. Not a performance. A signal that you enjoy this work and this conversation.',
    },
];

export function OnTheDay() {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    On The Day
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    Presence and delivery. The small things that carry the big ones.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ITEMS.map((it, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '14px 18px',
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 14,
                        }}
                    >
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.accentPetrol }}>{it.label}</p>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{it.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
