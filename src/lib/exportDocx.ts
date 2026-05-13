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
} from 'docx';
import { saveAs } from 'file-saver';

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
function parseInline(text: string, font: string, size: number): TextRun[] {
    const runs: TextRun[] = [];
    // Match **bold**, *italic*, or plain text
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match[2]) {
            runs.push(new TextRun({ text: match[2], bold: true, font, size }));
        } else if (match[3]) {
            runs.push(new TextRun({ text: match[3], italics: true, font, size }));
        } else if (match[4]) {
            runs.push(new TextRun({ text: match[4], font, size }));
        }
    }
    return runs.length > 0 ? runs : [new TextRun({ text, font, size })];
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
    const PLACEHOLDER_RE = /\[(?:VERIFY|Verify|verify|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?:[:\s][^\]]*)?\]/g;
    return normalized.replace(PLACEHOLDER_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,;:!?])/g, '$1');
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

    // Page margins: APS = 25mm all sides; default = 20mm sides, 25mm top/bottom
    const marginInches = docType === 'selection-criteria'
        ? { top: 1440, right: 1440, bottom: 1440, left: 1440 }   // ~25mm in twips
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
                    run: { font, size: FONT_SIZES[docType] },
                    paragraph: { spacing: { line: 276, lineRule: 'auto' as any } },
                },
            },
        },
        sections: [{
            properties: {
                page: {
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
            footers: {
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
            children: showSetupNotice
                ? [...buildSetupNotice(font), ...buildParagraphs(content, docType)]
                : buildParagraphs(content, docType),
        }],
    });

    const blob = await Packer.toBlob(doc);
    const namePart = candidateName.replace(/\s+/g, '_') || 'document';
    const identifier = company
        ? company.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 25)
        : jobTitle
            ? jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30)
            : '';
    const typeLabel = docTypeLabel[docType].replace(/\s+/g, '_');
    const fileName = identifier
        ? `${namePart}_${identifier}_${typeLabel}.docx`
        : `${namePart}_${typeLabel}.docx`;

    saveAs(blob, fileName);
}
