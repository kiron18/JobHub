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
import type { Style } from '@react-pdf/types';
// Interop-safe import: file-saver is CJS/UMD, so named imports break under
// node ESM (used by scripts/render-test.tsx); default + fallback works in both.
import fileSaverModule from 'file-saver';
const saveAs: (blob: Blob, filename?: string) => void =
    (fileSaverModule as any).saveAs ?? (fileSaverModule as any);

import { parseResume, parseResumeHeader } from './resumeStructure';
import type { ResumeSection, ResumeItem } from './resumeStructure';
import { buildExportFilename, deriveFromContent, type ExportDocType } from './exportFilename';

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

/**
 * A section's heading.
 *
 * Always the user's own heading text. Every section used to hard-code its
 * title, so a resume with both "Professional Experience" and "Additional
 * Experience" printed "Professional Experience" twice: `classifySection` maps
 * anything containing "experience" to the same section type, and the renderer
 * then ignored `section.title` entirely. The on-screen preview and the Word
 * download both showed the real heading, so the PDF was the only place the
 * user's wording disappeared — and it disappeared on the copy that goes to
 * employers. `fallback` covers a section that somehow reached us untitled.
 */
function sectionHeading({ title, fallback, isFirst }: { title?: string; fallback: string; isFirst?: boolean }) {
    return (
        <Text style={isFirst ? styles.firstSectionHeader : styles.sectionHeader}>
            {title?.trim() || fallback}
        </Text>
    );
}

// -------------------------------------------------------------------
// Section builders
//
// Sections render to a *flat* list of page-level blocks rather than to one
// <View> per section, and every builder below returns an array for that reason.
//
// react-pdf only reliably honours wrap={false} on a direct child of <Page>.
// Nested inside a section wrapper, a block that cannot fit the remaining space
// is drawn anyway — it runs off into the bottom margin instead of moving to the
// next page. That is the clipped last line users see at the foot of page 1.
//
// Flattening also fixes the order the text sits in the PDF's content stream.
// With nested wrappers, an entry that landed on a page boundary was emitted out
// of sequence — in one resume a job title and employer were written after the
// referees line, at the very end of the file. On screen it looked right,
// because the coordinates were right; an ATS reads the stream, not the
// coordinates, so it saw the employer filed under "Referees".
// -------------------------------------------------------------------

/**
 * Space below an entry. This is the one number to change if entries need to
 * breathe more or less; nothing else controls that spacing.
 *
 * Deliberately a touch tighter than the old wrapper `<View>` produced. That
 * wrapper's 5pt sat outside the last bullet's own 2pt and the two stacked, so
 * entries ending in a bullet used to get 7pt. A flat 5pt buys back roughly the
 * space the keep-together rule below costs, which is why a sweep of 62 content
 * lengths across two resume shapes never came out longer than before this
 * change, and came out a page shorter once. Page count is the thing a resume
 * cannot afford to lose, so it was worth being explicit about.
 */
const ENTRY_GAP = 5;

/**
 * Set the bottom margin on the block that ends an entry, standing in for the
 * wrapper `<View>` whose margin used to do this before the tree was flattened.
 */
function withGap(nodes: React.ReactNode[], gap: number): React.ReactNode[] {
    if (!nodes.length) return nodes;
    const last = nodes[nodes.length - 1] as React.ReactElement<{ style?: Style | Style[] }>;
    const own = last.props.style;
    const style: Style[] = [
        ...(Array.isArray(own) ? own : own ? [own] : []),
        { marginBottom: gap },
    ];
    return [...nodes.slice(0, -1), React.cloneElement(last, { style })];
}

/**
 * One role/project/degree entry, as page-level blocks.
 *
 * The entry's title, dates, employer and *first* bullet are held together in a
 * single `wrap={false}` block — the typesetting "keep with next" rule. It rules
 * out both ways the page break used to read as a mistake: a heading stranded
 * alone on the last line of a page, and a job title at the foot of one page
 * with the evidence for it overleaf. When a section's heading is passed in it
 * joins that same block, so a heading can never be the last thing on a page.
 *
 * Only the first bullet is held back. Holding a whole entry would shunt a long
 * role wholesale onto the next page and leave half a page blank, which can cost
 * a two-page resume a third page.
 *
 * `minPresenceAhead` was the previous attempt at this and did not hold: it
 * reserves space *after* a node rather than binding the node to what follows,
 * so a heading whose section started further up the page still stranded.
 */
function entryNodes(item: ResumeItem, heading?: React.ReactNode, gap = ENTRY_GAP): React.ReactNode[] {
    const [firstBullet, ...restBullets] = item.bullets ?? [];

    const nodes: React.ReactNode[] = [
        <View key="head" wrap={false}>
            {heading}
            <View style={styles.roleHeader}>
                <Text style={styles.roleTitle}>{item.title}</Text>
                {item.dates && <Text style={styles.roleDates}>{item.dates}</Text>}
            </View>
            {item.organization && <Text style={styles.companyLine}>{item.organization}</Text>}
            {item.descriptor && <Text style={styles.companyLine}>{item.descriptor}</Text>}
            {firstBullet !== undefined && (
                <Text style={styles.bullet}>•  {renderInline(firstBullet)}</Text>
            )}
        </View>,
        ...restBullets.map((bullet, j) => (
            <Text key={`b${j}`} style={styles.bullet}>•  {renderInline(bullet)}</Text>
        )),
        ...(item.notes ?? []).map((note, j) => (
            <Text key={`n${j}`} style={styles.paragraph}>{renderInline(note)}</Text>
        )),
    ];

    return withGap(nodes, gap);
}

/** A heading with its role/project entries. */
function entryListNodes({
    title,
    fallback,
    content,
    isFirst,
    gap,
}: {
    title?: string;
    fallback: string;
    content: ResumeItem[];
    isFirst?: boolean;
    gap?: number;
}): React.ReactNode[] {
    const heading = sectionHeading({ title, fallback, isFirst });

    // A section with no entries still has to announce itself.
    if (!content.length) return [heading];

    return content.flatMap((item, i) => entryNodes(item, i === 0 ? heading : undefined, gap));
}

/** A heading plus free-flowing lines (publications, languages, referees). */
function textSectionNodes({
    title,
    fallback,
    lines,
    lineStyle,
}: {
    title?: string;
    fallback: string;
    lines: string[];
    lineStyle: Style;
}): React.ReactNode[] {
    const heading = sectionHeading({ title, fallback });
    if (!lines.length) return [heading];

    const [firstLine, ...restLines] = lines;
    return [
        <View key="head" wrap={false}>
            {heading}
            <Text style={lineStyle}>{renderInline(firstLine)}</Text>
        </View>,
        ...restLines.map((line, i) => (
            <Text key={`l${i}`} style={lineStyle}>{renderInline(line)}</Text>
        )),
    ];
}

/**
 * Anything a specialised renderer did not know how to draw.
 *
 * Each specialised section renderer filters `content` down to the item shape it
 * understands — `skill` rows, `cert` rows — and silently drops the rest. That
 * loses real text: a section titled "Karaoke Skills" is typed as `skills`
 * because the word "skill" appears in it, so a person's bullets under it were
 * parsed correctly and then thrown away at render time. The heading still
 * printed, which made it look like a styling quirk rather than missing content.
 *
 * Every specialised renderer appends this, so whatever the user wrote reaches
 * the page even when it does not fit the section's expected shape.
 */
function leftoverNodes(
    content: ResumeItem[],
    understood: (item: ResumeItem) => boolean,
    keyPrefix: string,
): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    content.filter(item => !understood(item)).forEach((item, i) => {
        (item.bullets ?? []).forEach((bullet, j) => {
            nodes.push(
                <Text key={`${keyPrefix}b${i}-${j}`} style={styles.bullet}>•  {renderInline(bullet)}</Text>,
            );
        });
        const line = item.text ?? item.title;
        if (line) {
            nodes.push(
                <Text key={`${keyPrefix}t${i}`} style={styles.paragraph}>{renderInline(line)}</Text>,
            );
        }
    });
    return nodes;
}

/**
 * Every line an item carries, in reading order, with empties removed.
 *
 * The single-line sections used to read one named field per item, so an item
 * holding text where the renderer expected a title printed as a blank bullet,
 * and any bullets it carried were lost. Reading whatever is actually there
 * means a person's words survive however they typed them.
 */
function flattenItemLines(content: ResumeItem[]): string[] {
    return content
        .flatMap(item => [item.title, item.text, ...(item.bullets ?? [])])
        .map(line => (line ?? '').trim())
        .filter(Boolean);
}

function skillsNodes({ title, content }: { title?: string; content: ResumeItem[] }): React.ReactNode[] {
    const isSkill = (item: ResumeItem) => item.type === 'skill';
    const rows = content.filter(isSkill);
    const extra = leftoverNodes(content, isSkill, 'sk');
    const heading = sectionHeading({ title, fallback: 'Skills & Competencies' });
    const row = (item: ResumeItem, key: string) => (
        <View key={key} style={styles.skillRow}>
            <Text style={styles.skillLabel}>{item.label}:</Text>
            <Text style={styles.skillValues}>{renderInline(item.values ?? '')}</Text>
        </View>
    );

    if (!rows.length) return [heading, ...extra];

    return [
        <View key="head" wrap={false} style={styles.skillsContainer}>
            {heading}
            {row(rows[0], 'r0')}
        </View>,
        ...rows.slice(1).map((item, i) => row(item, `r${i + 1}`)),
        ...extra,
    ];
}

// -------------------------------------------------------------------
// Main Resume Document
// -------------------------------------------------------------------

/** The blocks one section contributes to the page, in reading order. */
function sectionNodes(section: ResumeSection, isFirstExperience: boolean): React.ReactNode[] {
    const { title, content } = section;

    switch (section.type) {
        case 'header':
            return [<HeaderSection content={content} />];
        case 'summary':
            return [<SummarySection content={content} />];
        case 'experience':
            return entryListNodes({ title, fallback: 'Professional Experience', content, isFirst: isFirstExperience });
        case 'education':
            return entryListNodes({ title, fallback: 'Education', content, gap: 6 });
        case 'skills':
            return skillsNodes({ title, content });
        case 'projects':
            return entryListNodes({ title, fallback: 'Projects', content });
        // These three read one line per item. Take whichever field the item
        // actually carries, include any bullets it holds, and drop empties —
        // mapping to a single field printed a bare "•" for anything that did
        // not happen to have a title, and lost the rest of the item entirely.
        case 'publications':
            return textSectionNodes({
                title, fallback: 'Publications',
                lines: flattenItemLines(content),
                lineStyle: styles.paragraph,
            });
        case 'certifications':
            return textSectionNodes({
                title, fallback: 'Certifications',
                lines: flattenItemLines(content).map(line => `•  ${line}`),
                lineStyle: styles.bullet,
            });
        case 'languages':
            return textSectionNodes({
                title, fallback: 'Languages',
                lines: flattenItemLines(content),
                lineStyle: styles.paragraph,
            });
        case 'referees':
            return textSectionNodes({
                title, fallback: 'Referees',
                lines: [flattenItemLines(content).join(' ') || 'Available upon request.'],
                lineStyle: styles.referees,
            });
        default:
            // A section we do not recognise — "Hobbies", "Interests", anything
            // a user invents. It must still render everything it holds. This
            // used to map items to `text` only, so bullets under an unfamiliar
            // heading vanished while the heading itself printed.
            if (content.some(item => item.bullets?.length)) {
                return entryListNodes({ title, fallback: title, content });
            }
            return textSectionNodes({
                title, fallback: title,
                lines: content.map(item => item.text || item.title || ''),
                lineStyle: styles.paragraph,
            });
    }
}

export function ResumeDocument({ sections }: { sections: ResumeSection[] }) {
    // Only the first experience section gets the tighter top margin; a resume
    // with an "Additional Experience" section has more than one.
    const firstExperience = sections.findIndex(s => s.type === 'experience');

    // One flat list of blocks, so react-pdf can move any of them to the next
    // page. Keys are assigned here because a block's position in the whole
    // document is the only thing that makes it unique.
    const blocks: React.ReactNode[] = sections.flatMap((section, i) =>
        sectionNodes(section, i === firstExperience).map((node, j) =>
            React.cloneElement(node as React.ReactElement, { key: `s${i}-${j}` }),
        ),
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>{blocks}</Page>
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

/**
 * How many pages this resume actually comes to.
 *
 * Renders through the real PDF pipeline rather than estimating from line
 * counts. Line counting cannot work: wrapping, headings, bold runs and bullet
 * lengths all change how much fits, and a page marker in the wrong place is
 * worse than none — someone will move content to fix a break that is not there.
 * This runs the same renderer the download uses, so the number is the truth.
 *
 * Costs a full render (roughly 100-300ms for a resume), so callers should
 * debounce it rather than run it on every keystroke.
 */
export async function countResumePages(content: string): Promise<number> {
    const sections = parseResume(sanitizeForExport(content));
    const blob = await pdf(<ResumeDocument sections={sections} />).toBlob();
    const text = await blob.text();
    // Page objects in the PDF body. The negative lookahead avoids matching
    // "/Type /Pages", the single node that lists them.
    return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

export async function exportPdf(
    content: string,
    docType: DocType,
    candidateName: string,
    jobTitle?: string,
    company?: string,
): Promise<void> {
    content = sanitizeForExport(content);

    // Callers often can't supply name/title; the document itself carries them,
    // so recover what's missing rather than falling back to a generic filename.
    if (!candidateName || !jobTitle) {
        const derived = deriveFromContent(content);
        candidateName = candidateName || (derived.candidateName ?? '');
        jobTitle = jobTitle || derived.jobTitle;
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

    saveAs(blob, buildExportFilename({
        candidateName,
        company,
        jobTitle,
        docType: docType as ExportDocType,
        extension: 'pdf',
    }));
}

export default exportPdf;
