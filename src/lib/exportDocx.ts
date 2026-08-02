/**
 * DOCX export for generated documents.
 *
 * Converts markdown-formatted document content into a properly styled Word document.
 * Uses APS formatting conventions for selection criteria (Arial 11pt, single-spaced),
 * and clean professional defaults for resumes and cover letters.
 */
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    convertInchesToTwip,
    PageNumber,
    Footer,
    Header,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    TabStopType,
    Tab,
} from 'docx';
import { saveAs } from 'file-saver';
import { parseResume, parseResumeHeader } from './resumeStructure';
import type { ResumeItem } from './resumeStructure';
import { buildExportFilename, deriveFromContent, type ExportDocType } from './exportFilename';

export type DocType = 'resume' | 'cover-letter' | 'selection-criteria' | 'interview-prep' | 'teaching-philosophy' | 'research-statement';

// APS spec: Arial 11pt, single-spaced, 25mm margins
// Resume / Cover Letter: Calibri 11pt, 1.15 line spacing
const FONTS: Record<DocType, string> = {
    'resume': 'Calibri',
    'cover-letter': 'Calibri',
    'selection-criteria': 'Arial',
    'interview-prep': 'Calibri',
    'teaching-philosophy': 'Calibri',
    'research-statement': 'Calibri',
};

const FONT_SIZES: Record<DocType, number> = {
    'resume': 22,           // half-points: 22 = 11pt
    'cover-letter': 22,
    'selection-criteria': 22,
    'interview-prep': 22,
    'teaching-philosophy': 22,
    'research-statement': 22,
};

interface ParsedLine {
    type: 'h1' | 'h2' | 'h3' | 'bullet' | 'para' | 'divider' | 'blank';
    text: string;
}

function parseLine(line: string): ParsedLine {
    const t = line.trim();
    if (!t) return { type: 'blank', text: '' };
    if (t.startsWith('# '))  return { type: 'h1', text: t.slice(2).trim() };
    if (t.startsWith('## ')) return { type: 'h2', text: t.slice(3).trim() };
    if (t.startsWith('### ')) return { type: 'h3', text: t.slice(4).trim() };
    if (t === '---' || t === '***') return { type: 'divider', text: '' };
    if (t.startsWith('- ') || t.startsWith('• ')) return { type: 'bullet', text: t.replace(/^[-•]\s/, '') };
    return { type: 'para', text: t };
}

/** Parse inline bold/italic within a text string into TextRun segments */
function parseInline(text: string, font: string, size: number, color?: string): TextRun[] {
    const runs: TextRun[] = [];
    // Match **bold**, *italic*, or plain text. Emphasised spans must open on a
    // non-asterisk: without that, a run of bare asterisks ("****") parses as an
    // italic span wrapping an asterisk and a character is lost. Kept in step
    // with `renderInline` in exportPdf.tsx so PDF and Word downloads agree.
    const regex = /(\*\*([^*].*?)\*\*|\*([^*].*?)\*|([^*]+))/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match[2]) {
            runs.push(new TextRun({ text: match[2], bold: true, font, size, color }));
        } else if (match[3]) {
            runs.push(new TextRun({ text: match[3], italics: true, font, size, color }));
        } else if (match[4]) {
            runs.push(new TextRun({ text: match[4], font, size, color }));
        }
    }
    return runs.length > 0 ? runs : [new TextRun({ text, font, size, color })];
}

function buildSetupNotice(font: string): Array<Table | Paragraph> {
    const textColor = '92400E'; // amber-800
    const headingColor = '78350F'; // amber-900
    const linkColor = '1D4ED8'; // blue-700
    return [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top:              { style: BorderStyle.SINGLE, size: 12, color: 'D97706' },
                bottom:           { style: BorderStyle.SINGLE, size: 12, color: 'D97706' },
                left:             { style: BorderStyle.SINGLE, size: 12, color: 'D97706' },
                right:            { style: BorderStyle.SINGLE, size: 12, color: 'D97706' },
                insideHorizontal: { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' },
                insideVertical:   { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
                            margins: { top: 140, bottom: 140, left: 220, right: 220 },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({
                                        text: '⚠  REVIEW BEFORE SENDING — DELETE THIS NOTE',
                                        bold: true, font, size: 18, color: headingColor,
                                    })],
                                    spacing: { before: 0, after: 100 },
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: 'This resume was built from your diagnostic answers and contains ', font, size: 18, color: textColor }),
                                        new TextRun({ text: '"Add…"', bold: true, font, size: 18, color: textColor }),
                                        new TextRun({ text: ' placeholders throughout. Find every one and replace it with your real content before sending this to anyone.', font, size: 18, color: textColor }),
                                    ],
                                    spacing: { before: 0, after: 100 },
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: 'The quickest way to fill the gaps: use the guided wizard at ', font, size: 18, color: textColor }),
                                        new TextRun({ text: 'aussiegradcareers.com.au/setup', bold: true, font, size: 18, color: linkColor }),
                                        new TextRun({ text: ' (about 6 minutes) — it coaches you through every section, then you re-download a complete version.', font, size: 18, color: textColor }),
                                    ],
                                    spacing: { before: 0, after: 0 },
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
        new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { before: 0, after: 280 },
        }),
    ];
}

function buildParagraphs(markdown: string, docType: DocType): Paragraph[] {
    const font = FONTS[docType];
    const size = FONT_SIZES[docType];
    const lines = markdown.split('\n');
    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < lines.length; i++) {
        const parsed = parseLine(lines[i]);

        switch (parsed.type) {
            case 'h1':
                paragraphs.push(new Paragraph({
                    children: [new TextRun({
                        text: parsed.text,
                        bold: true,
                        font,
                        size: docType === 'resume' ? 28 : 26, // 14pt or 13pt
                    })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 80 },
                }));
                break;

            case 'h2':
                paragraphs.push(new Paragraph({
                    children: [new TextRun({
                        text: parsed.text.toUpperCase(),
                        bold: true,
                        font,
                        size: 20,   // 10pt uppercase section labels
                        color: '4B5563',
                    })],
                    spacing: { before: 240, after: 60 },
                    border: {
                        bottom: {
                            color: 'E5E7EB',
                            style: BorderStyle.SINGLE,
                            size: 4,
                        },
                    },
                }));
                break;

            case 'h3':
                paragraphs.push(new Paragraph({
                    children: [new TextRun({
                        text: parsed.text,
                        bold: true,
                        font,
                        size: size,
                    })],
                    spacing: { before: 160, after: 40 },
                }));
                break;

            case 'bullet':
                paragraphs.push(new Paragraph({
                    children: parseInline(parsed.text, font, size),
                    bullet: { level: 0 },
                    spacing: { before: 40, after: 40 },
                    indent: { left: convertInchesToTwip(0.25) },
                }));
                break;

            case 'divider':
                paragraphs.push(new Paragraph({
                    children: [],
                    spacing: { before: 80, after: 80 },
                    border: {
                        bottom: {
                            color: 'D1D5DB',
                            style: BorderStyle.SINGLE,
                            size: 4,
                        },
                    },
                }));
                break;

            case 'blank':
                // Consecutive blank lines → one spacer paragraph
                if (i === 0 || parseLine(lines[i - 1]).type !== 'blank') {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: '' })],
                        spacing: { before: 0, after: 80 },
                    }));
                }
                break;

            case 'para':
            default:
                paragraphs.push(new Paragraph({
                    children: parseInline(parsed.text, font, size),
                    spacing: { before: 60, after: 60 },
                    // Cover letters and SC: 1.15 line spacing
                    ...(docType !== 'resume' && {
                        spacing: { before: 60, after: 100, line: 276, lineRule: 'auto' as any },
                    }),
                }));
                break;
        }
    }

    return paragraphs;
}

// -------------------------------------------------------------------
// Resume rendering — Master Resume Standard
//
// The Word download is the PDF, in Word: same page setup, same type scale, same
// colours, same structure off the shared parser (resumeStructure.ts). PDF is the
// default download and the one we point people at, but the .docx has to stand on
// its own when someone grabs it instead. Resumes used to fall through the generic
// markdown path below, where every date line and every "Part-time, Melbourne"
// descriptor became a full-height 11pt paragraph at 1.15 spacing — enough to
// push a two-page resume to three or four. Dates now sit right-aligned on the
// job-title line via a tab stop, the way the PDF and the signed-off template do.
// -------------------------------------------------------------------

const ACCENT = '475569';
const TEXT_DARK = '1A1A1A';
const MUTED = '6B7280';

// Same page setup as the PDF: 20mm sides, 48pt top and bottom. A4 is 11906
// twips wide, so this is the text column — and the position the right tab stop
// for the dates has to sit at.
const RESUME_MARGIN_X = 1134;  // 20mm
const RESUME_MARGIN_Y = 960;   // 48pt
const RESUME_CONTENT_WIDTH = 11906 - RESUME_MARGIN_X * 2;

// Half-points, matching exportPdf.tsx's point sizes.
const SZ_NAME = 44;      // 22pt
const SZ_HEADLINE = 22;  // 11pt
const SZ_CONTACT = 18;   // 9pt
const SZ_SECTION = 19;   // 9.5pt
const SZ_ROLE = 22;      // 11pt
const SZ_DATES = 19;     // 9.5pt
const SZ_BODY = 20;      // 10pt
// The PDF's `lineHeight: 1.3` is a multiple of the FONT SIZE (10pt -> 13pt line).
// Word's w:line with lineRule="auto" is a multiple of the font's NATURAL line
// height instead, which for Calibri is ~1.221em. Passing 312 (1.3) here would
// therefore give a 15.9pt line, looser than the resume it is meant to match and
// looser than the old broken export. 256/240 * 1.221 * 10pt = 13.0pt.
const LINE_BODY = 256;

// The name is the one serif element in the design. Georgia ships with both
// Windows and macOS, so the file opens looking the same on a recruiter's screen.
const SERIF = 'Georgia';

function sectionHeading(title: string, font: string, isFirst: boolean): Paragraph {
    return new Paragraph({
        children: [new TextRun({
            text: title.toUpperCase(),
            bold: true, font, size: SZ_SECTION, color: ACCENT,
            characterSpacing: 22,   // ~1.1pt tracking
        })],
        spacing: { before: isFirst ? 160 : 180, after: 80 },
        border: { bottom: { color: ACCENT, style: BorderStyle.SINGLE, size: 4 } },
    });
}

/** Job title on the left, dates right-aligned on the same line via a tab stop. */
function entryHeader(title: string, dates: string | undefined, font: string): Paragraph {
    const children = [new TextRun({ text: title, bold: true, font, size: SZ_ROLE, color: TEXT_DARK })];
    if (dates) {
        // Must be a real <w:tab/> element: a literal "\t" inside the run text is
        // not a tab to Word, and the date would butt against the job title.
        children.push(new TextRun({ children: [new Tab(), dates], font, size: SZ_DATES, color: MUTED }));
    }
    return new Paragraph({
        children,
        tabStops: [{ type: TabStopType.RIGHT, position: RESUME_CONTENT_WIDTH }],
        spacing: { before: 100, after: 20 },
    });
}

/** The italic line under a title: employer, or "Part-time, Melbourne". */
function subtitleLine(text: string, font: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, italics: true, font, size: SZ_BODY, color: MUTED })],
        spacing: { before: 0, after: 60 },
    });
}

function bulletLine(text: string, font: string): Paragraph {
    return new Paragraph({
        children: parseInline(text, font, SZ_BODY),
        bullet: { level: 0 },
        spacing: { before: 0, after: 40, line: LINE_BODY, lineRule: 'auto' as any },
        indent: { left: 240, hanging: 120 },
    });
}

function bodyLine(text: string, font: string, after = 120): Paragraph {
    return new Paragraph({
        children: parseInline(text, font, SZ_BODY),
        spacing: { before: 0, after, line: LINE_BODY, lineRule: 'auto' as any },
    });
}

function entryBlock(item: ResumeItem, font: string): Paragraph[] {
    const out: Paragraph[] = [entryHeader(item.title ?? '', item.dates, font)];
    if (item.organization) out.push(subtitleLine(item.organization, font));
    if (item.descriptor) out.push(subtitleLine(item.descriptor, font));
    for (const bullet of item.bullets ?? []) out.push(bulletLine(bullet, font));
    for (const note of item.notes ?? []) out.push(bodyLine(note, font));
    return out;
}

function buildResumeParagraphs(markdown: string, font: string): Paragraph[] {
    const sections = parseResume(markdown);
    const out: Paragraph[] = [];
    let seenHeading = false;

    for (const section of sections) {
        if (section.type === 'header') {
            const { name, headline, contactParts } = parseResumeHeader(section);
            if (name) {
                out.push(new Paragraph({
                    children: [new TextRun({ text: name, bold: true, font: SERIF, size: SZ_NAME, color: TEXT_DARK })],
                    spacing: { before: 0, after: 40, line: 240, lineRule: 'auto' as any },
                }));
            }
            if (headline) {
                out.push(new Paragraph({
                    children: [new TextRun({ text: headline, bold: true, font, size: SZ_HEADLINE, color: ACCENT })],
                    spacing: { before: 0, after: 120 },
                }));
            }
            if (contactParts.length) {
                out.push(new Paragraph({
                    children: [new TextRun({ text: contactParts.join('  |  '), font, size: SZ_CONTACT, color: MUTED })],
                    spacing: { before: 0, after: 200 },
                }));
            }
            continue;
        }

        out.push(sectionHeading(section.title, font, !seenHeading));
        seenHeading = true;

        for (const item of section.content) {
            switch (item.type) {
                case 'skill':
                    out.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${item.label}:  `, bold: true, font, size: SZ_SECTION, color: TEXT_DARK }),
                            ...parseInline(item.values ?? '', font, SZ_BODY),
                        ],
                        spacing: { before: 0, after: 60, line: LINE_BODY, lineRule: 'auto' as any },
                    }));
                    break;

                case 'role':
                case 'project':
                case 'degree':
                    out.push(...entryBlock(item, font));
                    break;

                case 'cert':
                    out.push(bulletLine(item.title ?? '', font));
                    break;

                default:
                    if (item.text) {
                        out.push(section.type === 'referees'
                            ? new Paragraph({
                                children: [new TextRun({ text: item.text, italics: true, font, size: SZ_BODY, color: MUTED })],
                                spacing: { before: 0, after: 60 },
                            })
                            : bodyLine(item.text, font));
                    }
                    break;
            }
        }
    }

    return out;
}

function sanitizeForExport(raw: string): string {
    // 1. Force section headers onto their own line. Some LLM outputs glue
    //    '## Section' onto the end of a paragraph; without this, parseLine()
    //    treats the whole line as a paragraph and the literal '##' renders.
    let normalized = raw.replace(/(\S)\s+(#{1,3}\s+\S)/g, '$1\n\n$2');

    // 2. Re-attach orphan heading markers. Some LLM outputs emit a bare '##'
    //    on its own line followed by the heading text on the next non-blank
    //    line (often with a blank line between). parseLine() only recognises
    //    '## Title' on one line, so without this fix the literal '##' renders
    //    as a paragraph and the title below loses its heading style.
    normalized = normalized.replace(/^(#{1,3})\s*$\n+(?=\S)/gm, '$1 ');

    // Strip all placeholder marker variants the generator emits. The preview
    // shows these as small chips for the user to review; the exported file is
    // for sending, so they must not survive into .docx.
    const PLACEHOLDER_RE = /\[(?:VERIFY|Verify|verify|MISSING|Missing|missing|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?:[:\s][^\]]*)?\]/g;
    // AI-rewrite badge token is screen-only; never include it in exports.
    const AI_TOKEN_RE = /\[AI\]\s*/g;
    return normalized
        .replace(PLACEHOLDER_RE, '')
        .replace(AI_TOKEN_RE, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([.,;:!?])/g, '$1');
}

export async function exportDocx(
    content: string,
    docType: DocType,
    candidateName: string,
    jobTitle?: string,
    company?: string,
    showSetupNotice?: boolean,
): Promise<void> {
    content = sanitizeForExport(content);
    const font = FONTS[docType];

    // Same recovery the PDF export does. Its absence here was the whole bug:
    // call sites pass an empty candidate name, so every Word download came out
    // as `document_Cover_Letter.docx` while the PDF of the same draft was named
    // properly.
    if (!candidateName || !jobTitle) {
        const derived = deriveFromContent(content);
        candidateName = candidateName || (derived.candidateName ?? '');
        jobTitle = jobTitle || derived.jobTitle;
    }

    const isResume = docType === 'resume';

    // Page margins: APS = 25mm all sides; resume matches the PDF design system
    // (20mm sides, 48pt top/bottom); everything else keeps the old defaults.
    const marginInches = docType === 'selection-criteria'
        ? { top: 1440, right: 1440, bottom: 1440, left: 1440 }   // ~25mm in twips
        : isResume
            ? { top: RESUME_MARGIN_Y, right: RESUME_MARGIN_X, bottom: RESUME_MARGIN_Y, left: RESUME_MARGIN_X }
            : { top: 1440, right: 1152, bottom: 1440, left: 1152 };   // 25mm top/bottom, 20mm sides

    const docTypeLabel: Record<DocType, string> = {
        'resume': 'Resume',
        'cover-letter': 'Cover Letter',
        'selection-criteria': 'Statement Addressing Selection Criteria',
        'interview-prep': 'Interview Preparation',
        'teaching-philosophy': 'Teaching Philosophy Statement',
        'research-statement': 'Research Statement',
    };

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font, size: isResume ? SZ_BODY : FONT_SIZES[docType] },
                    // The resume sets line height per paragraph; a 1.15 document
                    // default here would stack on top of it and blow the page count.
                    paragraph: { spacing: { line: isResume ? 240 : 276, lineRule: 'auto' as any } },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 },   // A4, stated so it never falls back to Letter
                    margin: marginInches,
                },
            },
            headers: docType === 'selection-criteria' ? {
                default: new Header({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: candidateName, bold: true, font, size: 18 }),
                                new TextRun({ text: ` — ${docTypeLabel[docType]}`, font, size: 18, color: '6B7280' }),
                            ],
                            alignment: AlignmentType.LEFT,
                            border: { bottom: { color: 'E5E7EB', style: BorderStyle.SINGLE, size: 4 } },
                            spacing: { after: 120 },
                        }),
                    ],
                }),
            } : undefined,
            // No page-number footer on a resume: the signed-off template has
            // none, and on a two-page resume it reads as report furniture.
            footers: isResume ? undefined : {
                default: new Footer({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ children: [PageNumber.CURRENT], font, size: 18, color: '9CA3AF' }),
                                new TextRun({ text: ' of ', font, size: 18, color: '9CA3AF' }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 18, color: '9CA3AF' }),
                            ],
                            alignment: AlignmentType.RIGHT,
                            border: { top: { color: 'E5E7EB', style: BorderStyle.SINGLE, size: 4 } },
                            spacing: { before: 80 },
                        }),
                    ],
                }),
            },
            children: (() => {
                const body = isResume
                    ? buildResumeParagraphs(content, font)
                    : buildParagraphs(content, docType);
                return showSetupNotice ? [...buildSetupNotice(font), ...body] : body;
            })(),
        }],
    });

    const blob = await Packer.toBlob(doc);

    // `docTypeLabel` above stays as the heading printed inside the document.
    // The filename label is deliberately shorter and lives in one shared place,
    // so Word and PDF downloads of the same draft agree on their name.
    saveAs(blob, buildExportFilename({
        candidateName,
        company,
        jobTitle,
        docType: docType as ExportDocType,
        extension: 'docx',
    }));
}
