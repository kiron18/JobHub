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

import { parseResume, parseResumeHeader } from './resumeStructure';
import type { ResumeSection, ResumeItem } from './resumeStructure';

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

// The parser lives in resumeStructure.ts so the Word exporter renders the
// exact same structure. Re-exported here because tests and older call sites
// import `parseResume` from this module.
export { parseResume };

// -------------------------------------------------------------------
// Inline emphasis
// -------------------------------------------------------------------

const inlineStyles = StyleSheet.create({
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
});

/**
 * Render inline markdown emphasis (**bold**, *italic*) as nested <Text> runs.
 *
 * Without this, `**40%**` reached the page as literal asterisks — the markdown
 * survived the parser but nothing ever turned it into formatting. The regex is
 * deliberately identical to `parseInline` in exportDocx.ts so a resume looks the
 * same whichever format the user downloads.
 *
 * Only ever called on body copy, which is all set in SourceSans (Regular, Bold
 * and Italic are registered). The one serif style — the candidate's name — is
 * left alone: SourceSerif ships without an italic face here, and asking
 * react-pdf for a face it has not been given throws at render time.
 *
 * Text with no emphasis is returned untouched, including any stray unmatched
 * asterisk, so nothing a user typed can silently vanish from their resume.
 */
export function renderInline(text: string): React.ReactNode {
    if (!text || !text.includes('*')) return text;

    const nodes: React.ReactNode[] = [];
    // Emphasised spans must open on a non-asterisk. Without that guard a run of
    // bare asterisks ("****") parses as an italic span wrapping an asterisk and
    // one of the user's characters disappears from the page.
    const regex = /(\*\*([^*].*?)\*\*|\*([^*].*?)\*|([^*]+))/g;
    let match: RegExpExecArray | null;
    let key = 0;
    let emphasised = false;

    while ((match = regex.exec(text)) !== null) {
        if (match[2] !== undefined) {
            nodes.push(<Text key={key++} style={inlineStyles.bold}>{match[2]}</Text>);
            emphasised = true;
        } else if (match[3] !== undefined) {
            nodes.push(<Text key={key++} style={inlineStyles.italic}>{match[3]}</Text>);
            emphasised = true;
        } else if (match[4] !== undefined) {
            nodes.push(match[4]);
        }
    }

    return emphasised ? nodes : text;
}

// -------------------------------------------------------------------
// Resume Renderer Components
// -------------------------------------------------------------------

function HeaderSection({ content }: { content: ResumeItem[] }) {
    const { name, headline, contactParts } = parseResumeHeader({
        type: 'header',
        title: '',
        content,
    });

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
    return <Text style={styles.summary}>{renderInline(text)}</Text>;
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
                        <Text key={j} style={styles.bullet}>•  {renderInline(bullet)}</Text>
                    ))}
                    {item.notes?.map((note, j) => (
                        <Text key={`n${j}`} style={styles.paragraph}>{renderInline(note)}</Text>
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
                        <Text style={styles.skillValues}>{renderInline(item.values ?? '')}</Text>
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
                        <Text key={j} style={styles.bullet}>•  {renderInline(bullet)}</Text>
                    ))}
                    {item.notes?.map((note, j) => (
                        <Text key={`n${j}`} style={styles.paragraph}>{renderInline(note)}</Text>
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
                <Text key={i} style={styles.paragraph}>{renderInline(item.text ?? '')}</Text>
            ))}
        </View>
    );
}

function CertificationsSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Certifications</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.bullet}>•  {renderInline(item.title ?? '')}</Text>
            ))}
        </View>
    );
}

function LanguagesSection({ content }: { content: ResumeItem[] }) {
    return (
        <View>
            <Text minPresenceAhead={40} style={styles.sectionHeader}>Languages</Text>
            {content.map((item, i) => (
                <Text key={i} style={styles.paragraph}>{renderInline(item.text ?? '')}</Text>
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
                <Text key={i} style={styles.paragraph}>{renderInline(item.text || item.title || '')}</Text>
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

export interface ParsedCoverLetter {
    contactBlock: string[];
    date: string;
    salutation: string;
    bodyParagraphs: string[];
    signoff: string[];
}

/** A date on its own line, e.g. "July 2026". */
const COVER_DATE_LINE = /^[A-Z][a-z]+\s+\d{4}$/;

/**
 * Split a cover letter into the blocks the PDF renders.
 *
 * Anchored on the salutation, because that is the only line whose position is
 * dependable. The generated format opens directly on "Dear …" with no contact
 * block and no date, and an earlier version of this walked a state machine that
 * only left its opening state when it met a date line — so with nothing above
 * the salutation the whole letter stayed classified as contact details and got
 * rendered in small grey type, body formatting and inline emphasis included.
 *
 * A letter with no salutation at all (someone deleted it) is treated as all
 * body: readable paragraphs are a far better failure than a page of grey.
 */
export function parseCoverLetter(content: string): ParsedCoverLetter {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const salutationIndex = lines.findIndex(l => l.startsWith('Dear '));

    const contactBlock: string[] = [];
    let date = '';

    // Everything above the salutation is letterhead: an optional date line, and
    // the sender's contact details.
    for (const line of lines.slice(0, salutationIndex === -1 ? 0 : salutationIndex)) {
        if (!date && COVER_DATE_LINE.test(line)) date = line;
        else contactBlock.push(line);
    }

    const bodyParagraphs: string[] = [];
    const signoff: string[] = [];
    let inSignoff = false;

    for (const line of lines.slice(salutationIndex + 1)) {
        if (line.includes('Yours sincerely') || line.includes('Yours faithfully')) {
            inSignoff = true;
        }
        (inSignoff ? signoff : bodyParagraphs).push(line);
    }

    return {
        contactBlock,
        date,
        salutation: salutationIndex === -1 ? '' : lines[salutationIndex],
        bodyParagraphs,
        signoff,
    };
}

// Exported for the render harness in scripts/, same as ResumeDocument.
export function CoverLetterDocument({ content }: { content: string }) {
    const { contactBlock, date, salutation, bodyParagraphs, signoff } = parseCoverLetter(content);

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
                    <Text key={i} style={coverStyles.paragraph}>{renderInline(para)}</Text>
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
