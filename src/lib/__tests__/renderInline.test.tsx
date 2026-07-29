/**
 * Unit tests for the PDF inline-emphasis renderer.
 *
 * Two properties matter more than the formatting itself:
 *   1. the visible text is never altered — a user's words survive verbatim,
 *      minus the markdown markers themselves;
 *   2. nothing a user typed is silently swallowed, including malformed or
 *      unmatched asterisks.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderInline } from '../exportPdf';
import { extractReactText } from '../extractReactText';

/** Flatten the rendered output to the text a reader would actually see. */
const visible = (input: string) => extractReactText(renderInline(input) as React.ReactNode);

/** Collect the emphasised fragments, tagged by the style applied to them. */
function marks(input: string): Array<{ style: 'bold' | 'italic'; text: string }> {
    const nodes = renderInline(input);
    if (!Array.isArray(nodes)) return [];
    const out: Array<{ style: 'bold' | 'italic'; text: string }> = [];
    for (const node of nodes) {
        if (!React.isValidElement(node)) continue;
        const props = node.props as { style?: { fontWeight?: string; fontStyle?: string }; children?: React.ReactNode };
        const style = props.style?.fontWeight === 'bold' ? 'bold' : props.style?.fontStyle === 'italic' ? 'italic' : null;
        if (style) out.push({ style, text: extractReactText(props.children) });
    }
    return out;
}

describe('renderInline', () => {
    it('leaves text with no emphasis exactly as it was', () => {
        const plain = 'Cut invoice processing time by 40% across three teams';
        expect(renderInline(plain)).toBe(plain);
    });

    it('renders **bold** as a bold run and drops the markers', () => {
        expect(marks('Cut processing time by **40%** across three teams'))
            .toEqual([{ style: 'bold', text: '40%' }]);
        expect(visible('Cut processing time by **40%** across three teams'))
            .toBe('Cut processing time by 40% across three teams');
    });

    it('renders *italic* as an italic run and drops the markers', () => {
        expect(marks('Supported UAT with a *defect reopen rate under 5%*'))
            .toEqual([{ style: 'italic', text: 'defect reopen rate under 5%' }]);
        expect(visible('Supported UAT with a *defect reopen rate under 5%*'))
            .toBe('Supported UAT with a defect reopen rate under 5%');
    });

    it('handles several emphasised spans in one line', () => {
        expect(marks('Grew revenue **12%** while cutting churn **3pts** in *nine months*'))
            .toEqual([
                { style: 'bold', text: '12%' },
                { style: 'bold', text: '3pts' },
                { style: 'italic', text: 'nine months' },
            ]);
    });

    it('emphasises a bullet that the user bolded end to end', () => {
        expect(marks('**The user bolded this entire bullet**'))
            .toEqual([{ style: 'bold', text: 'The user bolded this entire bullet' }]);
    });

    it('emphasises a metric sitting at the very start of a bullet', () => {
        expect(marks('**40%** reduction in invoice processing time'))
            .toEqual([{ style: 'bold', text: '40%' }]);
        expect(visible('**40%** reduction in invoice processing time'))
            .toBe('40% reduction in invoice processing time');
    });

    it('keeps an unmatched asterisk visible rather than eating it', () => {
        // A half-finished edit must never make a word disappear from the resume.
        expect(renderInline('Delivered 5 * 3 workshops')).toBe('Delivered 5 * 3 workshops');
        expect(renderInline('Cut costs by **40% and rising')).toBe('Cut costs by **40% and rising');
    });

    it('survives empty and undefined-ish input', () => {
        expect(renderInline('')).toBe('');
        expect(visible('****')).toBe('****');
    });

    it('does not treat the mid-word asterisks of a footnote as emphasis markers', () => {
        expect(visible('Revenue grew 12%*')).toBe('Revenue grew 12%*');
    });
});
