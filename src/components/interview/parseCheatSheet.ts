/**
 * The cheat sheet format.
 *
 * The generator writes a small marker language (### SECTION headings, LABEL:
 * fields, `||` between the two halves of a paired line) rather than free
 * markdown, because the page is a call companion and every block on it has a
 * job. Prose would have to be re-guessed on every render.
 *
 * Two things this parser must survive, because the model does both:
 *   1. wrapped lines. A SAY: script often runs over two or three lines, so any
 *      line that carries no marker continues the field that came before it.
 *   2. stray bold. `**SAY:**` and `**Story**` show up regardless of what the
 *      rules ask for, so markers are matched after asterisks are stripped.
 */

export interface Script { say: string; why: string }
export interface Pair { left: string; right: string }
export interface LikelyQuestion { q: string; say: string; tactic: string; back: string }

export interface CheatSheet {
    oneRule: string;
    opening: Script | null;
    gap: { label: string; say: string; why: string } | null;
    inTheAd: Pair[];
    proofPoints: Pair[];
    spares: Pair[];
    caution: string;
    showDontSay: Pair[];
    questions: LikelyQuestion[];
    cannotFumble: Pair[];
    beforeCall: string[];
    yourQuestions: string[];
    close: string;
    tone: string[];
    onePara: string;
}

const SECTIONS: Record<string, string> = {
    'ONE RULE': 'oneRule',
    'OPENING': 'opening',
    'THE GAP': 'gap',
    'IN THE AD': 'inTheAd',
    'PROOF POINTS': 'proofPoints',
    'SHOW DONT SAY': 'showDontSay',
    "SHOW DON'T SAY": 'showDontSay',
    'LIKELY QUESTIONS': 'questions',
    'CANNOT FUMBLE': 'cannotFumble',
    'BEFORE THE CALL': 'beforeCall',
    'YOUR QUESTIONS': 'yourQuestions',
    'TONE': 'tone',
    'IN ONE PARAGRAPH': 'onePara',
};

/** Bold, stray backticks, and the quote marks we re-add ourselves at render. */
const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();
const unquote = (s: string) => clean(s).replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim();

/** Strip a leading `LABEL:` from one half of a `||` pair. */
const dropLabel = (s: string) => clean(s).replace(/^[A-Z][A-Z' ]{1,14}:\s*/, '').trim();

function splitPair(line: string): Pair | null {
    const body = clean(line).replace(/^[-*•]\s*/, '');
    const idx = body.indexOf('||');
    if (idx === -1) return null;
    const left = dropLabel(body.slice(0, idx));
    const right = dropLabel(body.slice(idx + 2));
    if (!left && !right) return null;
    return { left, right };
}

/** Enough markers present that this is the new format and not a legacy doc. */
export function isCheatSheet(raw: string): boolean {
    if (!raw) return false;
    const keys = Object.keys(SECTIONS);
    const hits = keys.filter(k => new RegExp(`^#{2,4}\\s*\\**\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im').test(raw));
    return hits.length >= 4;
}

export function parseCheatSheet(raw: string): CheatSheet {
    const sheet: CheatSheet = {
        oneRule: '', opening: null, gap: null, inTheAd: [], proofPoints: [], spares: [],
        caution: '', showDontSay: [], questions: [], cannotFumble: [], beforeCall: [],
        yourQuestions: [], close: '', tone: [], onePara: '',
    };

    let section = '';
    // Where a wrapped continuation line should be appended. Held on an object
    // rather than in a local, because flow() and stop() are called through
    // closures and a plain `let` would be narrowed to null at every use site.
    const state: { cont: { obj: Record<string, string>; key: string } | null } = { cont: null };

    const flow = (obj: unknown, key: string | number) => {
        state.cont = { obj: obj as Record<string, string>, key: String(key) };
    };
    const stop = () => { state.cont = null; };
    /** Append a wrapped line to whatever field was last opened. */
    const carry = (text: string) => {
        const c = state.cont;
        if (!c) return;
        c.obj[c.key] = `${c.obj[c.key]} ${text}`.trim();
    };

    const paragraph = { oneRule: '', onePara: '' };

    for (const rawLine of raw.split('\n')) {
        // Tested before clean(), which strips `**` and would turn a `***` rule
        // into a lone `*`.
        if (/^\s*([-*_]\s*){3,}$/.test(rawLine)) { stop(); continue; }

        const line = clean(rawLine);
        if (!line) { stop(); continue; }

        // Section heading
        const heading = line.match(/^#{2,4}\s*(.+?)\s*$/);
        if (heading) {
            const key = SECTIONS[heading[1].toUpperCase().replace(/[:.]$/, '')];
            if (key) { section = key; stop(); continue; }
            // An unknown heading still ends whatever was flowing.
            stop();
            continue;
        }

        const field = line.match(/^([A-Z][A-Z' ]{0,14}):\s*(.*)$/);
        const label = field ? field[1].trim() : '';
        const value = field ? field[2].trim() : '';

        switch (section) {
            case 'oneRule':
                paragraph.oneRule += (paragraph.oneRule ? ' ' : '') + line;
                break;

            case 'onePara':
                paragraph.onePara += (paragraph.onePara ? ' ' : '') + line;
                break;

            case 'opening': {
                if (!sheet.opening) sheet.opening = { say: '', why: '' };
                if (label === 'SAY') {
                    sheet.opening.say = unquote(value);
                    flow(sheet.opening, 'say');
                } else if (label === 'WHY') {
                    sheet.opening.why = clean(value);
                    flow(sheet.opening, 'why');
                } else {
                    carry(unquote(line));
                }
                break;
            }

            case 'gap': {
                if (!sheet.gap) sheet.gap = { label: '', say: '', why: '' };
                if (label === 'GAP') {
                    sheet.gap.label = clean(value);
                    flow(sheet.gap, 'label');
                } else if (label === 'SAY') {
                    sheet.gap.say = unquote(value);
                    flow(sheet.gap, 'say');
                } else if (label === 'WHY') {
                    sheet.gap.why = clean(value);
                    flow(sheet.gap, 'why');
                } else {
                    carry(unquote(line));
                }
                break;
            }

            case 'inTheAd': {
                const pair = splitPair(line);
                if (pair) {
                    const row = { left: unquote(pair.left), right: pair.right };
                    sheet.inTheAd.push(row);
                    flow(row, 'right');
                } else {
                    carry(line);
                }
                break;
            }

            case 'proofPoints': {
                if (label === 'CAUTION') {
                    sheet.caution = clean(value);
                    flow(sheet, 'caution');
                    break;
                }
                const pair = splitPair(line);
                if (pair) {
                    // SPARE lines carry their label on the left of the pair.
                    const isSpare = /^spare\b/i.test(clean(line).replace(/^[-*•]\s*/, ''));
                    const target = isSpare ? sheet.spares : sheet.proofPoints;
                    target.push(pair);
                    flow(pair, 'right');
                } else {
                    carry(line);
                }
                break;
            }

            case 'showDontSay': {
                const pair = splitPair(line);
                if (pair) {
                    const row = { left: unquote(pair.left), right: unquote(pair.right) };
                    sheet.showDontSay.push(row);
                    flow(row, 'right');
                } else {
                    carry(unquote(line));
                }
                break;
            }

            case 'questions': {
                const last = sheet.questions[sheet.questions.length - 1];
                if (label === 'Q' || /^\d+\.\s/.test(line)) {
                    const text = label === 'Q' ? value : line.replace(/^\d+\.\s*/, '');
                    const row = { q: clean(text), say: '', tactic: '', back: '' };
                    sheet.questions.push(row);
                    flow(row, 'q');
                } else if (last && (label === 'SAY' || label === 'TACTIC' || label === 'BACK')) {
                    const key = label.toLowerCase() as 'say' | 'tactic' | 'back';
                    last[key] = key === 'tactic' ? clean(value) : unquote(value);
                    flow(last, key);
                } else {
                    carry(unquote(line));
                }
                break;
            }

            case 'cannotFumble': {
                const pair = splitPair(line);
                if (pair) {
                    // The value is usually a line to say, and the model wraps
                    // those in quotes. The page adds its own.
                    pair.right = unquote(pair.right);
                    sheet.cannotFumble.push(pair);
                    flow(pair, 'right');
                } else {
                    carry(line);
                }
                break;
            }

            case 'beforeCall':
            case 'tone': {
                const list = section === 'tone' ? sheet.tone : sheet.beforeCall;
                if (/^[-*•]\s+/.test(line)) {
                    list.push(clean(line).replace(/^[-*•]\s*/, ''));
                    flow(list, list.length - 1);
                } else {
                    carry(line);
                }
                break;
            }

            case 'yourQuestions': {
                if (label === 'CLOSE') {
                    sheet.close = unquote(value);
                    flow(sheet, 'close');
                } else if (/^[-*•]\s+/.test(line) || /^\d+\.\s/.test(line)) {
                    sheet.yourQuestions.push(unquote(clean(line).replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')));
                    flow(sheet.yourQuestions, sheet.yourQuestions.length - 1);
                } else {
                    carry(line);
                }
                break;
            }
        }
    }

    sheet.oneRule = paragraph.oneRule;
    sheet.onePara = paragraph.onePara;
    return sheet;
}
