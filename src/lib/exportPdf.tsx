/**
 * PDF export for generated documents.
 *
 * Uses @react-pdf/renderer (already installed, v4.3.2) to produce
 * ATS-safe, AU market-standard PDFs entirely client-side.
 * No server round-trip, no binary dependencies.
 */
import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

export type DocType =
    | 'resume'
    | 'cover-letter'
    | 'selection-criteria'
    | 'interview-prep'
    | 'teaching-philosophy'
    | 'research-statement';

// -------------------------------------------------------------------
// Styles — ATS-safe, AU market standard
// -------------------------------------------------------------------

const MARGIN_PT = 56.7; // ~20mm in points

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 11,
        paddingTop: MARGIN_PT,
        paddingBottom: MARGIN_PT,
        paddingHorizontal: MARGIN_PT,
        lineHeight: 1.4,
        color: '#111827',
    },
    h1: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4,
        marginTop: 0,
        color: '#111827',
    },
    h2: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginTop: 14,
        marginBottom: 4,
        color: '#4B5563',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 2,
    },
    h3: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        marginTop: 8,
        marginBottom: 2,
        color: '#111827',
    },
    para: {
        fontSize: 11,
        marginBottom: 4,
        color: '#111827',
    },
    bullet: {
        fontSize: 11,
        marginBottom: 3,
        marginLeft: 12,
        color: '#111827',
    },
    divider: {
        borderBottomWidth: 0.5,
        borderBottomColor: '#D1D5DB',
        marginVertical: 8,
    },
    spacer: {
        marginBottom: 6,
    },
});

// -------------------------------------------------------------------
// Markdown line parser
// -------------------------------------------------------------------

interface ParsedLine {
    type: 'h1' | 'h2' | 'h3' | 'bullet' | 'para' | 'divider' | 'blank';
    text: string;
}

function parseLine(line: string): ParsedLine {
    const t = line.trim();
    if (!t) return { type: 'blank', text: '' };
    if (t.startsWith('# ')) return { type: 'h1', text: t.slice(2).trim() };
    if (t.startsWith('## ')) return { type: 'h2', text: t.slice(3).trim() };
    if (t.startsWith('### ')) return { type: 'h3', text: t.slice(4).trim() };
    if (t === '---' || t === '***') return { type: 'divider', text: '' };
    if (t.startsWith('- ') || t.startsWith('• ')) return { type: 'bullet', text: t.replace(/^[-•]\s/, '') };
    return { type: 'para', text: t };
}

/** Strip markdown bold/italic markers — react-pdf Text doesn't parse inline markdown */
function stripInline(text: string): string {
    return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

// -------------------------------------------------------------------
// PDF Document component
// -------------------------------------------------------------------

function buildPdfDocument(markdown: string): React.ReactElement {
    const lines = markdown.split('\n');
    const elements: React.ReactElement[] = [];

    lines.forEach((line, i) => {
        const parsed = parseLine(line);
        switch (parsed.type) {
            case 'h1':
                elements.push(<Text key={i} style={styles.h1}>{stripInline(parsed.text)}</Text>);
                break;
            case 'h2':
                elements.push(<Text key={i} style={styles.h2}>{stripInline(parsed.text).toUpperCase()}</Text>);
                break;
            case 'h3':
                elements.push(<Text key={i} style={styles.h3}>{stripInline(parsed.text)}</Text>);
                break;
            case 'bullet':
                elements.push(<Text key={i} style={styles.bullet}>{'• ' + stripInline(parsed.text)}</Text>);
                break;
            case 'divider':
                elements.push(<View key={i} style={styles.divider} />);
                break;
            case 'blank':
                if (i > 0 && parseLine(lines[i - 1]).type !== 'blank') {
                    elements.push(<View key={i} style={styles.spacer} />);
                }
                break;
            case 'para':
            default:
                elements.push(<Text key={i} style={styles.para}>{stripInline(parsed.text)}</Text>);
        }
    });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {elements}
            </Page>
        </Document>
    );
}

// -------------------------------------------------------------------
// Public export function
// -------------------------------------------------------------------

const DOC_LABELS: Record<DocType, string> = {
    'resume': 'Resume',
    'cover-letter': 'Cover_Letter',
    'selection-criteria': 'Selection_Criteria',
    'interview-prep': 'Interview_Prep',
    'teaching-philosophy': 'Teaching_Philosophy',
    'research-statement': 'Research_Statement',
};

function sanitizeForExport(raw: string): string {
    return raw.replace(/\[VERIFY:[^\]]*\]/g, '').replace(/\s{2,}/g, ' ');
}

export async function exportPdf(
    content: string,
    docType: DocType,
    candidateName: string,
    jobTitle?: string,
    company?: string,
): Promise<void> {
    content = sanitizeForExport(content);
    const doc = buildPdfDocument(content);
    const blob = await pdf(doc as any).toBlob();
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
