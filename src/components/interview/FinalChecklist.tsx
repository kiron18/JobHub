import { warm } from '../../lib/theme/warmTokens';

export function FinalChecklist({ company }: { company?: string }) {
    const org = company && company.trim().length > 0 ? company.trim() : 'the organisation';

    const groups: { heading: string; items: string[] }[] = [
        {
            heading: 'The night before',
            items: [
                'Practise each CAR answer out loud. Once each. Record yourself if it helps.',
                'Write down three things you are proud of from your work. Read them before you sleep.',
                'Confirm the interview time, location, and the names of the panel.',
                'Lay out what you are wearing. Decide now, not in the morning.',
                `Read ${org}'s current priorities. Know one thing they are working on right now.`,
            ],
        },
        {
            heading: 'The morning of',
            items: [
                'Eat something. Do not arrive hungry.',
                'Re-read the five mindset anchors.',
                'Put your phone on silent before you enter the building.',
                'When they offer you water, say yes. It gives you a pause mechanism.',
            ],
        },
        {
            heading: 'In the room',
            items: [
                'Pause before every answer. One breath.',
                'Context, Action, Result. Name the outcome every time.',
                'If a question lands unexpectedly: "That is a great question, let me take a moment." Then take it.',
                'End with your two questions. The last impression matters as much as the first.',
            ],
        },
    ];

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    Final Checklist
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groups.map((g, gi) => (
                    <div key={gi}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.accentPetrol }}>{g.heading}</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {g.items.map((item, ii) => (
                                <li key={ii} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: warm.colors.accentGold }} />
                                    <span style={{ fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div
                style={{
                    padding: '18px 20px',
                    background: 'rgba(197,160,89,0.06)',
                    border: '1px solid rgba(197,160,89,0.30)',
                    borderRadius: 14,
                }}
            >
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary, lineHeight: 1.5 }}>
                    You are ready for this.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    Your experience, your values, and your track record are exactly what this role was written for. Walk in knowing that.
                </p>
            </div>
        </section>
    );
}
