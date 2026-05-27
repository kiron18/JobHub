// Deterministic profile → markdown renderer.
// Output guarantees: every heading on its own line, blank line above and below,
// no glued `##`, no orphan `##`. Feed into existing exportDocx / exportPdf.

import type { ResumeData } from './resumeData';

const dateRange = (start?: string, end?: string | null, isCurrent?: boolean) => {
    const right = isCurrent ? 'Present' : (end || '');
    if (start && right) return `${start} — ${right}`;
    return start || right || '';
};

const cleanBullets = (description?: string): string[] => {
    if (!description) return [];
    return description
        .split('\n')
        .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean);
};

export function profileToMarkdown(d: ResumeData): string {
    const lines: string[] = [];
    const push = (...ls: string[]) => lines.push(...ls);
    const section = (title: string) => push('', `## ${title}`, '');

    // Header — name, target role, contact
    push(`# ${d.name}`);
    push('');
    if (d.targetRole) { push(`*${d.targetRole}*`); push(''); }
    const contactBits = [d.email, d.phone, d.linkedin, d.location].filter(Boolean);
    if (contactBits.length) push(contactBits.join(' | '));

    if (d.professionalSummary) {
        section('Professional Summary');
        push(d.professionalSummary.trim());
    }

    if (d.experience.length) {
        section('Work Experience');
        d.experience.forEach((exp, i) => {
            push(`### ${exp.role} | ${exp.company}`);
            const meta = [dateRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ');
            if (meta) push(`*${meta}*`);
            const bullets = cleanBullets(exp.description);
            if (bullets.length) {
                push('');
                bullets.forEach(b => push(`- ${b}`));
            }
            if (i < d.experience.length - 1) push('');
        });
    }

    if (d.education.length) {
        section('Education');
        d.education.forEach(ed => {
            const right = ed.year || dateRange(ed.startDate, ed.endDate);
            const head = `**${ed.degree}${ed.field ? ` — ${ed.field}` : ''}**${right ? `  ·  ${right}` : ''}`;
            push(head);
            const sub = [ed.institution, ed.location].filter(Boolean).join(' — ');
            if (sub) push(sub);
            push('');
        });
    }

    const skillLines = (d.skills || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (skillLines.length) {
        section('Skills & Competencies');
        skillLines.forEach(line => {
            const colon = line.indexOf(':');
            if (colon === -1) { push(line); return; }
            const label = line.slice(0, colon).trim();
            const rest = line.slice(colon + 1).trim();
            push(`**${label}:** ${rest}`);
            push('');
        });
    }

    if (d.certifications?.length) {
        section('Certifications & Professional Development');
        d.certifications.forEach(c => {
            push(`- **${c.name}** — ${c.issuingBody}${c.year ? `  ·  ${c.year}` : ''}`);
        });
    }

    if (d.languages?.length) {
        section('Languages');
        push(d.languages.map(l => `${l.name} (${l.proficiency})`).join(' • '));
    }

    if (d.volunteering?.length) {
        section('Volunteering & Community Involvement');
        d.volunteering.forEach(v => {
            push(`**${v.role}** — ${v.organization}`);
            if (v.description) push(v.description.trim());
            push('');
        });
    }

    if (d.showReferees !== false) {
        section('Referees');
        push('Available upon request.');
    }

    // Trim trailing blanks, collapse 3+ consecutive newlines to 2
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
