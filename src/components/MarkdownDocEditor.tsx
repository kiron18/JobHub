/**
 * MarkdownDocEditor — the one markdown editor in this app.
 *
 * It was born inside `DocumentStep` in StepperWorkspace.tsx and lived there
 * alone. The welcome screen now needs the same thing: the candidate reads the
 * rebuilt resume and edits it in place before the single send. Two editors
 * would drift, and the half that drifts is always the one people meet first, so
 * the editor moved out here and `DocumentStep` points at it.
 *
 * What it owns, and why each piece exists:
 *
 *   - the textarea, and nothing about what the text means. The caller owns the
 *     buffer, so the caller decides when it is saved and to where.
 *   - the caret. Every toolbar action is a pure function over (text, start,
 *     end); the result carries where the caret should land, and a layout effect
 *     puts it back after React has re-rendered. That is what makes pressing
 *     Bold twice undo it rather than nest markers.
 *   - the line style under the caret, so the toolbar shows it lit. This is what
 *     teaches the format without a paragraph of instructions: put the cursor on
 *     a bullet and the bullet button is on.
 *   - Enter carrying a list on, so a section of points costs one "- " rather
 *     than one per line.
 *
 * It owns no persistence, no page count and no document type. Those differ
 * between the paid workspace and the welcome screen, and they belong to the
 * screen, not to the editing.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Heading2, List, Pilcrow } from 'lucide-react';
import { toggleEmphasis, type EmphasisMarker } from '../lib/toggleEmphasis';
import { toggleLinePrefix, continueList, lineStyleOf, type LineStyle } from '../lib/toggleLinePrefix';
import { warm } from '../lib/theme/warmTokens';

/**
 * The colours the toolbar draws itself in. Defaults are the in-app palette; the
 * welcome screen renders the editor on its own paper and passes its own. Only
 * the toolbar and the text colour take these — everything else inherits from
 * wherever the editor is placed.
 */
export interface EditorTone {
    text: string;
    muted: string;
    border: string;
    accent: string;
    /** Background of a lit structural button. */
    accentSoft: string;
    /** The hairline between the structural buttons and the emphasis pair. */
    divider: string;
}

const DEFAULT_TONE: EditorTone = {
    text: warm.colors.textPrimary,
    muted: warm.colors.textMuted,
    border: warm.colors.borderWhisper,
    accent: warm.colors.accentPetrol,
    accentSoft: 'rgba(45, 90, 110, 0.12)',
    divider: warm.colors.borderDefined,
};

/** The whole line `position` falls on, used to light up the toolbar. */
function currentLine(text: string, position: number): string {
    const start = position <= 0 ? 0 : text.lastIndexOf('\n', position - 1) + 1;
    const newline = text.indexOf('\n', position);
    return text.slice(start, newline === -1 ? text.length : newline);
}

export interface MarkdownDocEditorProps {
    /** The buffer being edited. The caller owns it and decides when it is saved. */
    value: string;
    onChange: (next: string) => void;
    onBlur?: () => void;
    /** Placed over the toolbar's default absolute position. */
    toolbarStyle?: React.CSSProperties;
    /** Placed over the textarea's default style. */
    textareaStyle?: React.CSSProperties;
    tone?: Partial<EditorTone>;
    autoFocus?: boolean;
    ariaLabel?: string;
}

/**
 * Renders a fragment: an absolutely-positioned toolbar, then the textarea. It
 * expects to sit inside a `position: relative` container, which is what both
 * callers give it — the toolbar belongs to the top-right corner of the document
 * surface, not to the flow above it.
 */
export function MarkdownDocEditor({
    value,
    onChange,
    onBlur,
    toolbarStyle,
    textareaStyle,
    tone,
    autoFocus,
    ariaLabel,
}: MarkdownDocEditorProps) {
    const t = { ...DEFAULT_TONE, ...tone };
    const editorRef = useRef<HTMLTextAreaElement>(null);
    // Where the caret should land once React has re-rendered the edited buffer.
    const pendingSelection = useRef<[number, number] | null>(null);
    /**
     * The style of the line the caret is on, so the toolbar can show it lit up.
     * Seeded from the first line, which is where the caret starts.
     */
    const [activeLineStyle, setActiveLineStyle] = useState<LineStyle>(() => lineStyleOf(currentLine(value, 0)));

    /**
     * Bold / italic over the current selection. `toggleEmphasis` owns the rules
     * about what may be marked — it keeps bullet and heading prefixes outside
     * the markers, since a line emphasised end to end can be re-read as a date
     * or a skills row when the document is exported.
     *
     * The caret is restored after React has re-rendered with the new buffer, so
     * the marked text stays selected and pressing the button again undoes it.
     */
    const applyEmphasis = (marker: EmphasisMarker) => {
        const textarea = editorRef.current;
        if (!textarea) return;

        const result = toggleEmphasis(value, textarea.selectionStart, textarea.selectionEnd, marker);
        if (result.text === value) return;

        pendingSelection.current = [result.selectionStart, result.selectionEnd];
        onChange(result.text);
    };

    /**
     * Heading / bullet / paragraph over the current line or selection — the
     * structural half of the toolbar. Same shape as `applyEmphasis`: the pure
     * function decides, this just hands it the caret and takes back where the
     * caret should end up.
     */
    const applyLineStyle = (style: LineStyle) => {
        const textarea = editorRef.current;
        if (!textarea) return;

        const result = toggleLinePrefix(value, textarea.selectionStart, textarea.selectionEnd, style);
        if (result.text === value) return;

        pendingSelection.current = [result.selectionStart, result.selectionEnd];
        onChange(result.text);
        setActiveLineStyle(lineStyleOf(currentLine(result.text, result.selectionStart)));
    };

    const syncActiveLineStyle = () => {
        const textarea = editorRef.current;
        if (!textarea) return;
        setActiveLineStyle(lineStyleOf(currentLine(textarea.value, textarea.selectionStart)));
    };

    useLayoutEffect(() => {
        const pending = pendingSelection.current;
        const textarea = editorRef.current;
        if (!pending || !textarea) return;
        pendingSelection.current = null;
        textarea.focus();
        textarea.setSelectionRange(pending[0], pending[1]);
    }, [value]);

    return (
        <>
            {/* Formatting controls. `onMouseDown` is prevented so clicking a
                button never pulls focus out of the textarea, which would drop
                the user's selection before the toggle could act on it — and, on
                a screen that saves on blur, would save mid-format.

                Structure first, then emphasis, split by a hairline: heading and
                bullet are the marks that change what the exporter builds, and
                they used to be the ones you had to type. The structural three
                light up to show what the current line already is. */}
            <div style={{
                position: 'absolute',
                top: 10,
                right: 62,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                zIndex: 1,
                ...toolbarStyle,
            }}>
                {([
                    { style: 'heading' as LineStyle, Icon: Heading2, title: 'Section heading' },
                    { style: 'bullet' as LineStyle, Icon: List, title: 'Bullet point' },
                    { style: 'body' as LineStyle, Icon: Pilcrow, title: 'Plain paragraph' },
                ]).map(({ style, Icon, title }) => {
                    const active = activeLineStyle === style;
                    return (
                        <button
                            key={style}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyLineStyle(style)}
                            title={title}
                            aria-label={title}
                            aria-pressed={active}
                            style={{
                                width: 26,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: active ? t.accentSoft : 'transparent',
                                border: `1px solid ${active ? t.accent : t.border}`,
                                borderRadius: 5,
                                color: active ? t.accent : t.muted,
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            <Icon size={13} strokeWidth={active ? 2.4 : 2} />
                        </button>
                    );
                })}

                <div style={{ width: 1, height: 16, background: t.divider, margin: '0 3px' }} />

                {([
                    { marker: '**' as EmphasisMarker, label: 'B', title: 'Bold (Ctrl+B)', weight: 800, style: 'normal' as const },
                    { marker: '*' as EmphasisMarker, label: 'I', title: 'Italic (Ctrl+I)', weight: 500, style: 'italic' as const },
                ]).map(({ marker, label, title, weight, style }) => (
                    <button
                        key={label}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyEmphasis(marker)}
                        title={title}
                        aria-label={title}
                        style={{
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: `1px solid ${t.border}`,
                            borderRadius: 5,
                            color: t.muted,
                            fontSize: 12,
                            fontWeight: weight,
                            fontStyle: style,
                            lineHeight: 1,
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <textarea
                ref={editorRef}
                value={value}
                autoFocus={autoFocus}
                aria-label={ariaLabel}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                onSelect={syncActiveLineStyle}
                onClick={syncActiveLineStyle}
                onKeyUp={syncActiveLineStyle}
                onKeyDown={(e) => {
                    // Enter carries the list on, so a section of points costs
                    // one "- " rather than one per line. Shift+Enter is left
                    // alone as the way to break out mid-point.
                    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        const textarea = e.currentTarget;
                        const carried = continueList(value, textarea.selectionStart, textarea.selectionEnd);
                        if (carried) {
                            e.preventDefault();
                            pendingSelection.current = [carried.selectionStart, carried.selectionEnd];
                            onChange(carried.text);
                            setActiveLineStyle(lineStyleOf(currentLine(carried.text, carried.selectionStart)));
                        }
                        return;
                    }
                    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
                    const key = e.key.toLowerCase();
                    if (key !== 'b' && key !== 'i') return;
                    e.preventDefault();
                    applyEmphasis(key === 'b' ? '**' : '*');
                }}
                spellCheck
                style={{
                    width: '100%',
                    minHeight: 360,
                    padding: 0,
                    paddingRight: 56,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: t.text,
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    ...textareaStyle,
                }}
            />
        </>
    );
}

/**
 * The amber note that explains the marks. Deliberately outside the document
 * card and in the amber this app already uses for tips: inside, in the card's
 * own background, it read as the first page of the resume rather than as a note
 * about it. Collapsed to a strip once read, because the toolbar carries the
 * same information permanently.
 *
 * It remembers being closed across documents and across screens — it is worth
 * one read and a nuisance on every document after that.
 */
export function FormattingHelp() {
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('jobhub_format_help') !== 'closed'; } catch { return true; }
    });

    return (
        <div style={{
            marginBottom: 10,
            borderRadius: 8,
            background: 'rgba(217, 119, 6, 0.07)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderLeft: '3px solid #d97706',
            overflow: 'hidden',
        }}>
            <button
                onClick={() => {
                    const next = !open;
                    setOpen(next);
                    try { localStorage.setItem('jobhub_format_help', next ? 'open' : 'closed'); } catch { /* noop */ }
                }}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: '#92400e',
                    textAlign: 'left',
                }}
                aria-expanded={open}
            >
                <span>Formatting help</span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {open && (
                <div style={{ padding: '0 12px 11px', fontSize: 12.5, lineHeight: 1.65, color: '#78350f' }}>
                    <div style={{ marginBottom: 8 }}>
                        Put the cursor on a line and use the toolbar, top right of the document:{' '}
                        <strong>heading</strong> for a new section, <strong>list</strong> for a point,{' '}
                        <strong>¶</strong> for ordinary text. The lit-up button tells you what the line already is.
                    </div>
                    <div style={{ marginBottom: 9 }}>
                        Press <strong>Enter</strong> at the end of a point and the next one starts itself. Press it on
                        an empty point to finish the list.
                    </div>
                    <div style={{ marginBottom: 6 }}>Typing the marks by hand works too — that is all the buttons do:</div>
                    <pre style={{
                        margin: 0, padding: '9px 12px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.72)',
                        border: '1px solid rgba(217, 119, 6, 0.22)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 12, lineHeight: 1.7, color: '#5c2e0a', whiteSpace: 'pre-wrap',
                    }}>{'## Hobbies\n- Long distance running\n- Volunteer surf lifesaving'}</pre>
                </div>
            )}
        </div>
    );
}
