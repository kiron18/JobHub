/**
 * Shared resume-markdown parser.
 *
 * Both exporters render the SAME structure: exportPdf.tsx draws it with
 * @react-pdf/renderer, exportDocx.ts draws it with the docx library. The parser
 * lives here so the two can never drift — the Word download losing the
 * right-aligned date line and the italic descriptor line, while the PDF kept
 * both, is exactly what this split prevents.
 *
 * Pure and side-effect free on purpose: importing it must not pull in the PDF
 * font stack.
 */

export interface ResumeSection {
    type: 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'publications' | 'certifications' | 'languages' | 'referees' | 'other';
    title: string;
    content: ResumeItem[];
}

export interface ResumeItem {
    type: 'role' | 'degree' | 'project' | 'publication' | 'cert' | 'language' | 'skill' | 'text';
    title?: string;
    organization?: string;
    descriptor?: string;
    dates?: string;
    bullets?: string[];
    /**
     * Free-standing lines that appear *after* an entry's bullets have started.
     * The renderer only ever emits an entry's metadata (dates, location, tech
     * stack) before its bullets, so anything arriving afterwards is body copy —
     * usually a line the user typed or emphasised themselves. Keeping it apart
     * from `descriptor` stops it being glued onto the company line, where it
     * would render as an italic subtitle under the job title instead of as the
     * paragraph the on-screen preview showed them.
     */
    notes?: string[];
    text?: string;
    label?: string;
    values?: string;
}

/**
 * Parse resume markdown into structured sections
 * (exported for render tests)
 */
export function parseResume(markdown: string): ResumeSection[] {
    const lines = markdown.split('\n');
    const sections: ResumeSection[] = [];
    let currentSection: ResumeSection | null = null;
    let currentItem: ResumeItem | null = null;
    let inHeader = true;
    let headerLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Parse header (name, headline, contact) — the header spans everything
        // up to the first "## " section, with blank lines in between.
        if (inHeader) {
            if (line.startsWith('## ')) {
                inHeader = false;
                sections.push({
                    type: 'header',
                    title: '',
                    content: [{ type: 'text', text: headerLines.join('\n') }],
                });
                // fall through to the section-header handling below
            } else {
                if (line.startsWith('# ')) {
                    headerLines.push(line);
                } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
                    headerLines.push(line);
                } else if (line.includes('|')) {
                    headerLines.push(line);
                }
                continue;
            }
        }

        // Section headers
        if (line.startsWith('## ')) {
            if (currentSection) {
                if (currentItem) {
                    currentSection.content.push(currentItem);
                    currentItem = null;
                }
                sections.push(currentSection);
            }
            const title = line.slice(3).trim();
            currentSection = {
                type: classifySection(title),
                title,
                content: [],
            };
            continue;
        }

        // Role/project entries (### Role | Company)
        if (line.startsWith('### ')) {
            if (currentItem && currentSection) {
                currentSection.content.push(currentItem);
            }
            const roleMatch = line.slice(4).match(/^(.+?)\s*\|\s*(.+)$/);
            if (roleMatch) {
                currentItem = {
                    type: currentSection?.type === 'projects' ? 'project' : 'role',
                    title: roleMatch[1].trim(),
                    organization: roleMatch[2].trim(),
                    bullets: [],
                };
            } else {
                currentItem = {
                    type: 'role',
                    title: line.slice(4).trim(),
                    bullets: [],
                };
            }
            continue;
        }

        // Date lines (*Mmm YYYY - Mmm YYYY*, *2023*, *2024 - 2025*) and italic
        // descriptor lines under an entry (tech stack, company blurb)
        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && currentItem) {
            // Metadata only ever precedes the bullets. Once bullets have begun,
            // an italicised line is something the user wrote or emphasised, and
            // must not be absorbed into the entry's company line.
            if (currentItem.bullets?.length) {
                (currentItem.notes ??= []).push(line);
                continue;
            }
            const inner = line.replace(/^\*+|\*+$/g, '').trim();
            if (/\d{4}/.test(inner) && !currentItem.dates) {
                currentItem.dates = inner;
            } else if (inner) {
                currentItem.descriptor = currentItem.descriptor ? `${currentItem.descriptor} ${inner}` : inner;
            }
            continue;
        }

        /**
         * Sections further down parse their own bullets into richer shapes
         * (certifications become `cert` entries, publications become
         * `publication`, and so on). The catch-all below must not intercept
         * those, or a certification list turns into anonymous bullet text.
         */
        const SELF_PARSING_SECTIONS = [
            'certifications', 'publications', 'languages', 'skills', 'referees', 'education',
        ] as const;

        // Bullets
        if (line.startsWith('- ') && currentSection) {
            if (currentItem) {
                currentItem.bullets?.push(line.slice(2).trim());
                continue;
            }

            // A bullet with no "### entry" above it belongs to the section
            // itself. Someone who writes "## Hobbies" and puts bullets under it
            // is doing the obvious thing, and until now those bullets were
            // dropped on the floor: the heading still printed, so the loss was
            // invisible. Give them an entry to live in — unless the section
            // knows how to parse its own bullets.
            if (!SELF_PARSING_SECTIONS.includes(currentSection.type as never)) {
                currentItem = { type: 'text', bullets: [] };
                currentItem.bullets?.push(line.slice(2).trim());
                continue;
            }
        }

        // Education entries (**Degree** · Year)
        if (line.startsWith('**') && line.includes('**') && currentSection?.type === 'education') {
            if (currentItem && currentSection) {
                currentSection.content.push(currentItem);
            }
            const degreeMatch = line.match(/\*\*(.+?)\*\*\s*·\s*(.+)/);
            if (degreeMatch) {
                currentItem = {
                    type: 'degree',
                    title: degreeMatch[1].trim(),
                    dates: degreeMatch[2].trim(),
                };
            }
            continue;
        }

        // Institution line (follows degree)
        if (currentItem?.type === 'degree' && !currentItem.organization && line && !line.startsWith('**')) {
            currentItem.organization = line.trim();
            continue;
        }

        // Skills lines (**Label:** values)
        if (line.startsWith('**') && line.includes(':**') && currentSection?.type === 'skills') {
            const skillMatch = line.match(/\*\*(.+?):\*\*\s*(.+)/);
            if (skillMatch) {
                currentSection.content.push({
                    type: 'skill',
                    label: skillMatch[1].trim(),
                    values: skillMatch[2].trim(),
                });
            }
            continue;
        }

        // Publication lines
        if (currentSection?.type === 'publications' && line && !line.startsWith('##')) {
            currentSection.content.push({ type: 'publication', text: line });
            continue;
        }

        // Certification lines (bold or plain bullets)
        if (currentSection?.type === 'certifications' && line.startsWith('- ')) {
            const certMatch = line.match(/- \*\*(.+?)\*\*/);
            currentSection.content.push({
                type: 'cert',
                title: certMatch ? certMatch[1].trim() : line.slice(2).trim(),
            });
            continue;
        }

        // Language lines
        if (currentSection?.type === 'languages' && line) {
            currentSection.content.push({ type: 'language', text: line });
            continue;
        }

        // Referees
        if (currentSection?.type === 'referees' && line) {
            currentSection.content.push({ type: 'text', text: line });
            continue;
        }

        // Plain descriptor lines under a role/project (company blurb, tech stack).
        // Same rule as above: descriptors precede bullets, body copy follows them.
        if (line && currentItem && (currentItem.type === 'role' || currentItem.type === 'project')) {
            if (currentItem.bullets?.length) {
                (currentItem.notes ??= []).push(line);
            } else {
                currentItem.descriptor = currentItem.descriptor ? `${currentItem.descriptor} ${line}` : line;
            }
            continue;
        }

        // Generic text for other sections.
        //
        // Previously only 'summary' kept these, so a plain sentence written
        // under any other heading was discarded while the heading still
        // printed. Someone adding "## Interests" and a line about themselves
        // must see it come out the other side, whatever section they invented.
        if (line && currentSection && !currentItem) {
            // Strip a leading bullet marker. A line only reaches here when the
            // section's own parser did not take it, and rendering "- Bachelor of
            // Business" would print the dash literally as body text.
            currentSection.content.push({
                type: 'text',
                text: line.startsWith('- ') ? line.slice(2).trim() : line,
            });
        }

    }

    // Push final section/item
    if (currentItem && currentSection) {
        currentSection.content.push(currentItem);
    }
    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

export function classifySection(title: string): ResumeSection['type'] {
    const lower = title.toLowerCase();
    if (lower.includes('summary') || lower.includes('profile')) return 'summary';
    if (lower.includes('experience') || lower.includes('work')) return 'experience';
    if (lower.includes('education')) return 'education';
    if (lower.includes('skill')) return 'skills';
    if (lower.includes('project')) return 'projects';
    if (lower.includes('publication')) return 'publications';
    if (lower.includes('certification')) return 'certifications';
    if (lower.includes('language')) return 'languages';
    if (lower.includes('referee')) return 'referees';
    return 'other';
}

export interface ResumeHeader {
    name: string;
    headline: string;
    /** Contact items already split on "|" and trimmed, empties dropped. */
    contactParts: string[];
}

/**
 * Split the header block (everything above the first "## " section) into the
 * name, the headline, and the contact items. Shared so the Word and PDF
 * downloads agree on what counts as a headline versus a contact line.
 */
export function parseResumeHeader(section: ResumeSection | undefined): ResumeHeader {
    const text = section?.content[0]?.text || '';
    let name = '';
    let headline = '';
    let contact = '';

    for (const line of text.split('\n')) {
        if (line.startsWith('# ')) {
            name = line.slice(2).trim();
        } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
            headline = line.slice(1, -1).trim();
        } else if (line.includes('|')) {
            contact = line;
        }
    }

    return {
        name,
        headline,
        contactParts: contact.split('|').map(p => p.trim()).filter(Boolean),
    };
}
