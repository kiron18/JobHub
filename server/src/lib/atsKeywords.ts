export interface AtsCheckOptions {
    jobDescription: string;
    generatedDocument: string;
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'INTERVIEW_PREP';
}

export interface AtsCheckResult {
    topKeywords: string[];
    missingFromOutput: string[];
    coverage: number;
    warnings: string[];
}

const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'must', 'about', 'into', 'over', 'after', 'before', 'between', 'under',
    'above', 'below', 'up', 'down', 'out', 'off', 'than', 'then', 'also',
    'very', 'just', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'same', 'so',
    'too', 'very', 'this', 'that', 'these', 'those',
    'what', 'you', 'your', 'will', 'our', 'we', 'us', 'its', 'who', 'why',
    'how', 'when', 'where', 'been', 'being', 'doing', 'having', 'using',
    'looking', 'working', 'joining', 'based', 'located', 'including',
    'related', 'required', 'supporting', 'managing', 'across', 'within',
    'without', 'through', 'during', 'while', 'because', 'like', 'well',
    'make', 'take', 'get', 'set', 'new', 'one', 'two', 'able', 'help',
    'best', 'high', 'team', 'role', 'work', 'join', 'staff', 'member',
    'company', 'organisation', 'organization', 'including', 'provide',
    'proven', 'language', 'skills', 'relevant', 'leading', 'strong',
    'level', 'year', 'years', 'plus', 'including', 'preferred', 'nice',
    'across', 'within',  'full', 'part', 'time', 'along', 'manage',
]);

const SECTION_HEADER_WORDS = new Set([
    'requirements', 'responsibilities', 'qualifications', 'description',
    'skills', 'experience', 'education', 'summary', 'about', 'overview',
    'duties', 'accountabilities', 'key', 'essential', 'desirable',
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9'\-]+/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !SECTION_HEADER_WORDS.has(t) && /[a-z]/.test(t));
}

function extractPhrases(text: string): string[] {
    const phrases: string[] = [];
    // Capture multi-word phrases: quoted strings, or sequences of capitalized words
    const quoteRegex = /"([^"]{5,})"/g;
    let m;
    while ((m = quoteRegex.exec(text)) !== null) {
        phrases.push(m[1].toLowerCase().trim());
    }
    // Key: value pairs (e.g., "Employment Type: Full-time")
    const kvRegex = /^[A-Za-z\s]+:\s*(.+)$/gm;
    while ((m = kvRegex.exec(text)) !== null) {
        const val = m[1].trim();
        if (val.length > 3 && val.length < 60) phrases.push(val.toLowerCase());
    }
    return phrases;
}

function extractRoleTitleWords(jd: string): string[] {
    // The first few lines of a JD typically contain the role title
    const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const firstLines = lines.slice(0, Math.min(5, lines.length)).join(' ');
    const words = firstLines
        .toLowerCase()
        .replace(/[^a-z0-9\s'\-&]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !SECTION_HEADER_WORDS.has(w) && /[a-z]/.test(w));
    return [...new Set(words)];
}

function scoreKeywords(jd: string): Map<string, number> {
    const scores = new Map<string, number>();
    const tokens = tokenize(jd);

    // Count raw frequency
    for (const t of tokens) {
        scores.set(t, (scores.get(t) || 0) + 1);
    }

    // Boost: capitalized individual words (proper nouns, tools)
    const capWords = jd.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    for (const w of capWords) {
        const lower = w.toLowerCase();
        if (!STOPWORDS.has(lower) && !SECTION_HEADER_WORDS.has(lower) && lower.length >= 3) {
            scores.set(lower, (scores.get(lower) || 0) + 2);
        }
    }

    // Boost: PascalCase words as whole units (TypeScript, PowerBI, etc.)
    const pascalWords = jd.match(/\b[A-Z][a-z]+[A-Z][a-z]+[A-Za-z]*\b/g) || [];
    for (const w of pascalWords) {
        const lower = w.toLowerCase();
        scores.set(lower, (scores.get(lower) || 0) + 3);
    }

    // Boost: role title words — only keep those that also appear elsewhere in JD
    const titleWords = extractRoleTitleWords(jd);
    for (const w of titleWords) {
        // Only boost if the word also appears outside the role title lines (freq > 0)
        if (scores.has(w)) {
            scores.set(w, (scores.get(w) || 0) + 3);
        }
    }

    // Boost: words after "Requirements" / "Qualifications" section headers
    const sectionStarters = [/(?:requirements|qualifications|what you'?ll? (?:need|bring)|about you)\s*:*\s*\n/i];
    for (const pattern of sectionStarters) {
        const match = pattern.exec(jd);
        if (match) {
            const afterSection = jd.slice(match.index + match[0].length);
            const sectionEnd = /\n\s*\n(?:#{1,3}\s|Benefits|What we offer)/i.exec(afterSection);
            const relevantText = sectionEnd
                ? afterSection.slice(0, sectionEnd.index)
                : afterSection.slice(0, 500);
            const reqTokens = tokenize(relevantText);
            for (const t of reqTokens) {
                scores.set(t, (scores.get(t) || 0) + 2);
            }
        }
    }

    return scores;
}

// Build phrase-level keywords (2-3 word combinations from capitalized runs)
function extractPhraseKeywords(jd: string): string[] {
    const phrases: string[] = [];

    // Multi-word capitalized phrases (tools, frameworks, specific terms)
    const capPhrases = jd.match(/(?:[A-Z][a-z]{2,}\s+){1,2}[A-Z][a-z]{2,}/g);
    if (capPhrases) {
        for (const p of capPhrases) {
            const lower = p.toLowerCase().trim();
            const words = lower.split(/\s+/);
            // Skip if ALL words are stopwords or section headers
            const meaningfulWords = words.filter(w => !STOPWORDS.has(w) && !SECTION_HEADER_WORDS.has(w));
            if (meaningfulWords.length === 0) continue;
            if (lower.length >= 5 && lower.length <= 50) {
                phrases.push(lower);
            }
        }
    }

    // Tool names — both explicit list and any PascalCase that could be a tool
    const toolList = /\b(React|Node\.?(?:js)?|TypeScript|JavaScript|Python|AWS|GCP|Azure|SAP|Salesforce|Tableau|PowerBI|Jira|Confluence|Figma|Sketch|Adobe|Hootsuite|Sprout\s+Social|WordPress|Drupal|HubSpot|Marketo|Google\s+Analytics|SQL|PostgreSQL|MongoDB|Docker|Kubernetes|Terraform|GitLab|GitHub|CircleCI|Jenkins)\b/gi;
    let toolMatch;
    while ((toolMatch = toolList.exec(jd)) !== null) {
        phrases.push(toolMatch[0].toLowerCase().trim());
    }

    return [...new Set(phrases)];
}

function isKeywordInDocument(keyword: string, document: string): boolean {
    const doc = document.toLowerCase();
    // Word-boundary check for single words
    if (!keyword.includes(' ')) {
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        return regex.test(document);
    }
    // Phrase check: all words present within a small window
    const words = keyword.split(/\s+/);
    if (words.length <= 2) {
        return doc.includes(keyword);
    }
    // For longer phrases, check if all words appear within 5 words of each other
    const docWords = doc.split(/\s+/);
    const kwWords = words.map(w => w.toLowerCase());
    for (let i = 0; i <= docWords.length - kwWords.length; i++) {
        let match = true;
        for (let j = 0; j < kwWords.length; j++) {
            if (docWords[i + j] !== kwWords[j]) { match = false; break; }
        }
        if (match) return true;
    }
    return false;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function checkAtsKeywords(opts: AtsCheckOptions): AtsCheckResult {
    const { jobDescription, generatedDocument } = opts;

    // Step 1: Score and rank JD keywords
    const scores = scoreKeywords(jobDescription);
    const phraseKeywords = extractPhraseKeywords(jobDescription);

    // Sort by score descending, take top 15
    const sortedWords = [...scores.entries()]
        .filter(([word]) => word.length >= 3 && !SECTION_HEADER_WORDS.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);

    // Combine with phrase-level keywords, deduplicate, limit to 15
    const allKeywords = [...new Set([...phraseKeywords, ...sortedWords])].slice(0, 15);

    // Step 2: Check presence in generated document
    const missing: string[] = [];
    const roleTitleWords = extractRoleTitleWords(jobDescription);

    for (const kw of allKeywords) {
        if (!isKeywordInDocument(kw, generatedDocument)) {
            missing.push(kw);
        }
    }

    // Step 3: Compute coverage
    const coverage = allKeywords.length > 0
        ? (allKeywords.length - missing.length) / allKeywords.length
        : 1;

    // Step 4: Generate warnings
    const warnings: string[] = [];
    const criticalMissing = missing.filter(kw =>
        roleTitleWords.some(rw => kw.includes(rw))
    );
    if (criticalMissing.length > 0) {
        warnings.push(
            `CRITICAL: Role title keyword(s) missing from body: ${criticalMissing.join(', ')}. ` +
            `ATS scoring for this role likely filters the resume before a human reads it.`
        );
    }
    if (coverage < 0.5) {
        warnings.push(
            `ATS keyword coverage is ${Math.round(coverage * 100)}%. ` +
            `Consider weaving in the missing keywords naturally from your achievement bank.`
        );
    }

    return { topKeywords: allKeywords, missingFromOutput: missing, coverage, warnings };
}
