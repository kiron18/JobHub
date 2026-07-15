/**
 * PDF export for generated documents — Phase 4 Design Pass
 *
 * ATS-safe, single-column, designed to master resume standard:
 * - Source Serif 4 (or EB Garamond) for name/headlines
 * - Source Sans 3 (or Inter) for body text
 * - No images/icons, real selectable text
 * - A4 with 20mm margins
 *
 * Font files must be placed in src/assets/fonts/:
 *   - SourceSerif4-Regular.ttf, SourceSerif4-Bold.ttf
 *   - SourceSans3-Regular.ttf, SourceSans3-Bold.ttf, SourceSans3-Italic.ttf
 */
import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
// Interop-safe import: file-saver is CJS/UMD, so named imports break under
// node ESM (used by scripts/render-test.tsx); default + fallback works in both.
import fileSaverModule from 'file-saver';
const saveAs: (blob: Blob, filename?: string) => void =
    (fileSaverModule as any).saveAs ?? (fileSaverModule as any);

export type DocType =
    | 'resume'
    | 'cover-letter'
    | 'selection-criteria'
    | 'interview-prep'
    | 'teaching-philosophy'
    | 'research-statement';

// -------------------------------------------------------------------
// Font Registration
// -------------------------------------------------------------------

// Register local font files. If fonts are not present, falls back to Helvetica.
// Fonts should be placed in src/assets/fonts/ and copied to dist during build.
const FONT_BASE_URL = typeof window !== 'undefined'
    ? `${window.location.origin}/fonts/`
    : './fonts/';

// Attempt to register custom fonts; failures are silent and we fall back to Helvetica
try {
    Font.register({
        family: 'SourceSerif',
        fonts: [
            { src: `${FONT_BASE_URL}SourceSerif4-Regular.ttf`, fontWeight: 'normal' },
            { src: `${FONT_BASE_URL}SourceSerif4-Bold.ttf`, fontWeight: 'bold' },
        ],
    });
} catch {
    // Falls back to built-in Helvetica
}

try {
    Font.register({
        family: 'SourceSans',
        fonts: [
            { src: `${FONT_BASE_URL}SourceSans3-Regular.ttf`, fontWeight: 'normal' },
            { src: `${FONT_BASE_URL}SourceSans3-Bold.ttf`, fontWeight: 'bold' },
            { src: `${FONT_BASE_URL}SourceSans3-Italic.ttf`, fontStyle: 'italic' },
        ],
    });
} catch {
    // Falls back to built-in Helvetica
}

// Font families to use (with fallbacks)
const SERIF_FONT = 'SourceSerif';
const SANS_FONT = 'SourceSans';

// -------------------------------------------------------------------
// Design System — Master Resume Standard
// -------------------------------------------------------------------

const MARGIN_PT = 56.7; // ~20mm in points
const ACCENT_COLOR = '#475569'; // Steel blue / slate
const TEXT_COLOR = '#1a1a1a'; // Near-black
const MUTED_COLOR = '#6b7280'; // Grey for contact, dates

const styles = StyleSheet.create({
    page: {
        fontFamily: SANS_FONT,
        fontSize: 10.5,
        paddingTop: 48,
        paddingBottom: 48,
        paddingHorizontal: MARGIN_PT,
        lineHeight: 1.35,
        color: TEXT_COLOR,
    },
    // Name: serif, ~22pt, near-black
    name: {
        fontFamily: SERIF_FONT,
        fontSize: 22,
        fontWeight: 'bold',
        color: TEXT_COLOR,
        lineHeight: 1.1,
        marginBottom: 2,
    },
    // Headline (job title): bold, ~11pt, accent colour
    headline: {
        fontFamily: SANS_FONT,
        fontSize: 11,
        fontWeight: 'bold',
        color: ACCENT_COLOR,
        marginBottom: 6,
    },
    // Contact line: 9pt, muted grey, items separated by " | "
    contact: {
        fontFamily: SANS_FONT,
        fontSize: 9,
        color: MUTED_COLOR,
        marginBottom: 10,
    },
    contactLink: {
        color: ACCENT_COLOR,
    },
    // Section headers: ~9.5pt, UPPERCASE with ~0.12em letter-spacing,
    // ONE accent colour, hairline rule underneath, generous top margin (~16pt)
    sectionHeader: {
        fontFamily: SANS_FONT,
        fontSize: 9.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1.1,
        color: ACCENT_COLOR,
        marginTop: 9,
        marginBottom: 4,
        paddingBottom: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: ACCENT_COLOR,
    },
    // First section has less top margin
    firstSectionHeader: {
        fontFamily: SANS_FONT,
        fontSize: 9.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1.1,
        color: ACCENT_COLOR,
        marginTop: 8,
        marginBottom: 4,
        paddingBottom: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: ACCENT_COLOR,
    },
    // Role/project entry container
    roleEntry: {
        marginBottom: 5,
    },
    // Role header: title left, dates right on same line
    roleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 1,
    },
    // Role title: bold 11pt
    roleTitle: {
        fontFamily: SANS_FONT,
        fontSize: 11,
        fontWeight: 'bold',
        color: TEXT_COLOR,
        flex: 1,
    },
    // Role dates: right-aligned, muted 9.5pt
    roleDates: {
        fontFamily: SANS_FONT,
        fontSize: 9.5,
        color: MUTED_COLOR,
        textAlign: 'right',
    },
    // Company/institution line: italic descriptor
    companyLine: {
        fontFamily: SANS_FONT,
        fontSize: 10,
        fontStyle: 'italic',
        color: MUTED_COLOR,
        marginBottom: 3,
    },
    // Bullets: 10.5pt, 1.35 line height, hanging indent
    bullet: {
        fontFamily: SANS_FONT,
        fontSize: 10,
        lineHeight: 1.3,
        marginBottom: 2,
        paddingLeft: 12,
        textIndent: -6,
    },
    // Professional summary paragraph
    summary: {
        fontFamily: SANS_FONT,
        fontSize: 10,
        lineHeight: 1.3,
        marginBottom: 6,
    },
    // Skills section: label/value rows
    skillsContainer: {
        marginTop: 4,
    },
    skillRow: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    // Bold small-caps label in ~120pt left column
    skillLabel: {
        fontFamily: SANS_FONT,
        fontSize: 9.5,
        fontWeight: 'bold',
        fontVariant: 'small-caps',
        width: 118,
        color: TEXT_COLOR,
    },
    skillValues: {
        fontFamily: SANS_FONT,
        fontSize: 10,
        flex: 1,
        color: TEXT_COLOR,
    },
    // Plain paragraph (for publications, etc)
    paragraph: {
        fontFamily: SANS_FONT,
        fontSize: 10,
        lineHeight: 1.3,
        marginBottom: 4,
    },
    // Referees
    referees: {
        fontFamily: SANS_FONT,
        fontSize: 10.5,
        fontStyle: 'italic',
        color: MUTED_COLOR,
        marginTop: 4,
    },
});

// -------------------------------------------------------------------
// Resume Content Parser
// -------------------------------------------------------------------

interface ResumeSection {
    type: 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'publications' | 'certifications' | 'languages' | 'referees' | 'other';
    title: string;
    content: ResumeItem[];
}

interface ResumeItem {
    type: 'role' | 'degree' | 'project' | 'publication' | 'cert' | 'language' | 'skill' | 'text';
    title?: string;
    organization?: string;
    descriptor?: string;
    dates?: string;
    bullets?: string[];
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
            const inner = line.replace(/^\*+|\*+$/g, '').trim();
            if (/\d{4}/.test(inner) && !currentItem.dates) {
                currentItem.dates = inner;
            } else if (inner) {
                currentItem.descriptor = currentItem.descriptor ? `${currentItem.descriptor} ${inner}` : inner;
            }
            continue;
        }

        // Bullets
        if (line.startsWith('- ') && currentItem) {
            currentItem.bullets?.push(line.slice(2).trim());
            continue;
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

        // Plain descriptor lines under a role/project (company blurb, tech stack)
        if (line && currentItem && (currentItem.type === 'role' || currentItem.type === 'project')) {
            currentItem.descriptor = currentItem.descriptor ? `${currentItem.descriptor} ${line}` : line;
            continue;
        }

        // Generic text for other sections
        if (line && currentSection && !currentItem) {
            if (currentSection.type === 'summary') {
                currentSection.content.push({ type: 'text', text: line });
            }
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

function classifySection(title: string): ResumeSection['type'] {
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

// -------------------------------------------------------------------
// Resume Renderer Components
// -------------------------------------------------------------------

function HeaderSection({ content }: { content: ResumeItem[] }) {
    const text = content[0]?.text || '';
    const lines = text.split('\n');

    let name = '';
    let headline = '';
    let contact = '';

    for (const line of lines) {
        if (line.startsWith('# ')) {
            name = line.slice(2).trim();
        } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
            headline = line.slice(1, -1).trim();
        } else if (line.includes('|')) {
            contact = line;
        }
    }

    // Parse contact line into styled segments
    const contactParts = contact.split('|').map(p => p.trim()).filter(Boolean);

    return (
        <View>
            {name && <Text style={styles.name}>{name}</Text>}
            {headline && <Text style={styles.headline}>{headline}</Text>}
            {contactParts.length > 0 && (
                <Text style={styles.contact}>
                    {contactParts.map((part, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && ' | '}
                            {part.includes('http') || part.includes('@') ? (
                                <Text style={styles.contactLink}>{part}</Text>
                            ) : part}
                        </React.Fragment>
                    ))}
                </Text>
            )}
        </View>
    );
}

function SummarySection({ content }: { content: ResumeItem[] }) {
    const text = content.map(c => c.text).filter(Boolean).join(' ');
    return <Text style={styles.summary}>{text}</Text>;
}

function ExperienceSection({ content, isFirst }: { content: ResumeItem[]; isFirst: boolean }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={isFirst ? styles.firstSectionHeader : styles.sectionHeader}>Professional Experience</Text>
            {content.map((item, i) => (
                <View key={i} style={styles.roleEntry}>
                    <View minPresenceAhead={50} style={styles.roleHeader}>
                        <Text style={styles.roleTitle}>{item.title}</Text>
                        {item.dates && <Text style={styles.roleDates}>{item.dates}</Text>}
                    </View>
                    {item.organization && (
                        <Text style={styles.companyLine}>{item.organization}</Text>
                    )}
                    {item.descriptor && (
                        <Text style={styles.companyLine}>{item.descriptor}</Text>
                    )}
                    {item.bullets?.map((bullet, j) => (
                        <Text key={j} style={styles.bullet}>•  {bullet}</Text>
                    ))}
                </View>
            ))}
        </View>
    );
}

function EducationSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Education</Text>
            {content.map((item, i) => (
                <View key={i} style={{ marginBottom: 6 }}>
                    <View minPresenceAhead={50} style={styles.roleHeader}>
                        <Text style={styles.roleTitle}>{item.title}</Text>
                        {item.dates && <Text style={styles.roleDates}>{item.dates}</Text>}
                    </View>
                    {item.organization && (
                        <Text style={styles.companyLine}>{item.organization}</Text>
                    )}
                </View>
            ))}
        </View>
    );
}

function SkillsSection({ content }: { content: ResumeItem[] }) {
    return (
        <View style={styles.skillsContainer}>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Skills & Competencies</Text>
            {content.map((item, i) => (
                item.type === 'skill' && (
                    <View key={i} style={styles.skillRow}>
                        <Text style={styles.skillLabel}>{item.label}:</Text>
                        <Text style={styles.skillValues}>{item.values}</Text>
                    </View>
                )
            ))}
        </View>
    );
}

function ProjectsSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Projects</Text>
            {content.map((item, i) => (
                <View key={i} style={styles.roleEntry}>
                    <View minPresenceAhead={50} style={styles.roleHeader}>
                        <Text style={styles.roleTitle}>{item.title}</Text>
                        {item.dates && <Text style={styles.roleDates}>{item.dates}</Text>}
                    </View>
                    {item.organization && (
                        <Text style={styles.companyLine}>{item.organization}</Text>
                    )}
                    {item.descriptor && (
                        <Text style={styles.companyLine}>{item.descriptor}</Text>
                    )}
                    {item.bullets?.map((bullet, j) => (
                        <Text key={j} style={styles.bullet}>•  {bullet}</Text>
                    ))}
                </View>
            ))}
        </View>
    );
}

function PublicationsSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Publications</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.paragraph}>{item.text}</Text>
            ))}
        </View>
    );
}

function CertificationsSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Certifications</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.bullet}>•  {item.title}</Text>
            ))}
        </View>
    );
}

function LanguagesSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Languages</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.paragraph}>{item.text}</Text>
            ))}
        </View>
    );
}

function RefereesSection({ content }: { content: ResumeItem[] }) {
    const text = content.map(c => c.text).filter(Boolean).join(' ');
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Referees</Text>
            <Text style={styles.referees}>{text || 'Available upon request.'}</Text>
        </View>
    );
}

function GenericSection({ title, content }: { title: string; content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>{title}</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.paragraph}>{item.text || item.title}</Text>
            ))}
        </View>
    );
}

// -------------------------------------------------------------------
// Main Resume Document
// -------------------------------------------------------------------

export function ResumeDocument({ sections }: { sections: ResumeSection[] }) {
    let experienceSeen = false;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {sections.map((section, i) => {
                    switch (section.type) {
                        case 'header':
                            return <HeaderSection key={i} content={section.content} />;
                        case 'summary':
                            return <SummarySection key={i} content={section.content} />;
                        case 'experience':
                            const isFirstExp = !experienceSeen;
                            experienceSeen = true;
                            return <ExperienceSection key={i} content={section.content} isFirst={isFirstExp} />;
                        case 'education':
                            return <EducationSection key={i} content={section.content} />;
                        case 'skills':
                            return <SkillsSection key={i} content={section.content} />;
                        case 'projects':
                            return <ProjectsSection key={i} content={section.content} />;
                        case 'publications':
                            return <PublicationsSection key={i} content={section.content} />;
                        case 'certifications':
                            return <CertificationsSection key={i} content={section.content} />;
                        case 'languages':
                            return <LanguagesSection key={i} content={section.content} />;
                        case 'referees':
                            return <RefereesSection key={i} content={section.content} />;
                        default:
                            return <GenericSection key={i} title={section.title} content={section.content} />;
                    }
                })}
            </Page>
        </Document>
    );
}

// -------------------------------------------------------------------
// Cover Letter Renderer (simpler structure)
// -------------------------------------------------------------------

const coverStyles = StyleSheet.create({
    page: {
        fontFamily: SANS_FONT,
        fontSize: 11,
        paddingTop: MARGIN_PT,
        paddingBottom: MARGIN_PT,
        paddingHorizontal: MARGIN_PT,
        lineHeight: 1.4,
        color: TEXT_COLOR,
    },
    contactBlock: {
        marginBottom: 20,
    },
    contactLine: {
        fontSize: 10,
        color: MUTED_COLOR,
        marginBottom: 2,
    },
    date: {
        fontSize: 11,
        marginBottom: 16,
    },
    salutation: {
        fontSize: 11,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 11,
        lineHeight: 1.4,
        marginBottom: 12,
        textAlign: 'justify',
    },
    signoff: {
        fontSize: 11,
        marginTop: 24,
    },
});

function CoverLetterDocument({ content }: { content: string }) {
    const lines = content.split('\n').filter(l => l.trim());

    // Extract components
    let contactBlock: string[] = [];
    let date = '';
    let salutation = '';
    let bodyParagraphs: string[] = [];
    let signoff: string[] = [];

    let inContact = true;
    let inBody = false;
    let inSignoff = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (inContact) {
            if (trimmed.match(/^[A-Z][a-z]+\s+\d{4}$/)) {
                date = trimmed;
                inContact = false;
                continue;
            }
            contactBlock.push(trimmed);
            continue;
        }

        if (trimmed.startsWith('Dear ')) {
            salutation = trimmed;
            inBody = true;
            continue;
        }

        if (trimmed.includes('Yours sincerely') || trimmed.includes('Yours faithfully')) {
            inBody = false;
            inSignoff = true;
        }

        if (inSignoff) {
            signoff.push(trimmed);
        } else if (inBody) {
            bodyParagraphs.push(trimmed);
        }
    }

    return (
        <Document>
            <Page size="A4" style={coverStyles.page}>
                <View style={coverStyles.contactBlock}>
                    {contactBlock.map((line, i) => (
                        <Text key={i} style={coverStyles.contactLine}>{line}</Text>
                    ))}
                </View>
                {date && <Text style={coverStyles.date}>{date}</Text>}
                {salutation && <Text style={coverStyles.salutation}>{salutation}</Text>}
                {bodyParagraphs.map((para, i) => (
                    <Text key={i} style={coverStyles.paragraph}>{para}</Text>
                ))}
                <View style={coverStyles.signoff}>
                    {signoff.map((line, i) => (
                        <Text key={i} style={i === 0 ? coverStyles.paragraph : { fontSize: 11 }}>{line}</Text>
                    ))}
                </View>
            </Page>
        </Document>
    );
}

// -------------------------------------------------------------------
// Sanitization
// -------------------------------------------------------------------

function sanitizeForExport(raw: string): string {
    // Strip placeholder markers
    const PLACEHOLDER_RE = /\[(?:VERIFY|Verify|verify|MISSING|Missing|missing|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?::\s*[^\]]*)?\]/g;
    const AI_TOKEN_RE = /\[AI\]\s*/g;
    return raw
        .replace(PLACEHOLDER_RE, '')
        .replace(AI_TOKEN_RE, '')
        .replace(/[^\S\r\n]{2,}/g, ' ')
        .replace(/[ \t]+([.,;:!?])/g, '$1')
        .trim();
}

// -------------------------------------------------------------------
// Public Export Functions
// -------------------------------------------------------------------

const DOC_LABELS: Record<DocType, string> = {
    'resume': 'Resume',
    'cover-letter': 'Cover_Letter',
    'selection-criteria': 'Selection_Criteria',
    'interview-prep': 'Interview_Prep',
    'teaching-philosophy': 'Teaching_Philosophy',
    'research-statement': 'Research_Statement',
};

export async function exportPdf(
    content: string,
    docType: DocType,
    candidateName: string,
    jobTitle?: string,
    company?: string,
): Promise<void> {
    content = sanitizeForExport(content);

    // Callers often can't supply name/title; the generated markdown itself
    // carries both ("# Name" line, then "*Job Title*" line), so derive
    // missing values from it rather than falling back to a generic filename.
    if (!candidateName) {
        candidateName = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
    }
    if (!jobTitle) {
        jobTitle = content.match(/^\*([^*\n]+)\*$/m)?.[1]?.trim() ?? '';
    }

    let doc: React.ReactElement<DocumentProps>;

    if (docType === 'resume') {
        const sections = parseResume(content);
        doc = <ResumeDocument sections={sections} />;
    } else if (docType === 'cover-letter') {
        doc = <CoverLetterDocument content={content} />;
    } else {
        // Fallback to resume parser for other types
        const sections = parseResume(content);
        doc = <ResumeDocument sections={sections} />;
    }

    const blob = await pdf(doc).toBlob();

    const namePart = candidateName.replace(/\s+/g, '_') || 'document';
    const identifier = company
        ? company.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 25)
        : jobTitle
            ? jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30)
            : '';
    const label = DOC_LABELS[docType];
    const fileName = identifier ? `${namePart}_${identifier}_${label}.pdf` : `${namePart}_${label}.pdf`;

    saveAs(blob, fileName);
}

export default exportPdf;
