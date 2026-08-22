/**
 * Speech to text, via AssemblyAI.
 *
 * The browser's own SpeechRecognition would cost nothing and need no key, and
 * it is the wrong choice here. Our candidates speak accented Australian
 * English, most of them second-language, and the browser recogniser is trained
 * hardest on the accents they do not have. A misheard word is not a cosmetic
 * problem in this pipeline: the cleaning step downstream will happily smooth a
 * mangled word into a confident, wrong one, and the candidate proof-reads a
 * sentence that reads fluently and never notices the noun changed.
 *
 * `wordBoost` is the cheap fix for the other half of the problem. Nobody's
 * general model knows "gel electrophoresis" or "Elgar Homes", but every one of
 * those words is sitting in the candidate's own resume, so we hand them over.
 */
import axios from 'axios';

const API = 'https://api.assemblyai.com/v2';
const KEY = process.env.ASSEMBLYAI_API_KEY;

export class TranscriptionUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionUnavailable';
  }
}

export const transcriptionConfigured = () => Boolean(KEY);

/**
 * Proper nouns and jargon worth biasing the recogniser towards.
 *
 * Capped and filtered: the API takes a limited list, and boosting an ordinary
 * word makes every similar-sounding word worse rather than better.
 */
export function wordBoostFrom(resume: string, limit = 200): string[] {
  const stop = new Set([
    'The', 'This', 'That', 'And', 'For', 'With', 'From', 'Was', 'Were', 'Have',
    'Has', 'Had', 'Not', 'But', 'All', 'Any', 'One', 'Two', 'Address', 'Email',
    'Phone', 'Tel', 'Education', 'Employment', 'Experience', 'Skills', 'Referees',
    'References', 'Career', 'Profile', 'Present', 'Current', 'January', 'February',
    'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November',
    'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  ]);

  const found = new Set<string>();

  // Capitalised runs: employers, universities, suburbs, product names.
  for (const match of resume.match(/\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,3}\b/g) || []) {
    const term = match.trim();
    if (term.split(/\s+/).every((w) => stop.has(w))) continue;
    if (term.length < 4 || term.length > 40) continue;
    found.add(term);
  }

  // Lower-case technical terms, which are the ones a general model mangles most.
  for (const match of resume.match(/\b[a-z]{7,}(?:\s+[a-z]{5,})?\b/g) || []) {
    if (/^(?:including|responsible|management|university|experience|australian|different|following|community|knowledge|assisted|involved|activities|organized|organised)$/.test(match)) continue;
    found.add(match);
  }

  return [...found].slice(0, limit);
}

interface AssemblyTranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
}

/**
 * Upload, transcribe, wait.
 *
 * Polling rather than webhooks on purpose: an intake answer is a minute or two
 * of audio and comes back in seconds, and a webhook would need a public URL
 * plus somewhere to park the half-finished answer.
 */
export async function transcribe(audio: Buffer, resumeForBoost?: string): Promise<string> {
  if (!KEY) {
    throw new TranscriptionUnavailable(
      'Voice answers need ASSEMBLYAI_API_KEY set on the server. Type the answer instead for now.',
    );
  }

  const headers = { authorization: KEY };

  const uploaded = await axios.post<{ upload_url: string }>(`${API}/upload`, audio, {
    headers: { ...headers, 'content-type': 'application/octet-stream' },
    maxBodyLength: Infinity,
    timeout: 120000,
  });

  const started = await axios.post<AssemblyTranscript>(`${API}/transcript`, {
    audio_url: uploaded.data.upload_url,
    language_code: 'en_au',
    punctuate: true,
    format_text: true,
    // Disfluencies are kept deliberately. The cleaning step removes them under a
    // check that proves it only removed; letting the recogniser drop them first
    // would hide that work from the check.
    disfluencies: true,
    word_boost: resumeForBoost ? wordBoostFrom(resumeForBoost) : undefined,
    boost_param: resumeForBoost ? 'high' : undefined,
  }, { headers, timeout: 30000 });

  const id = started.data.id;
  const deadline = Date.now() + 5 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const polled = await axios.get<AssemblyTranscript>(`${API}/transcript/${id}`, { headers, timeout: 30000 });

    if (polled.data.status === 'completed') return (polled.data.text || '').trim();
    if (polled.data.status === 'error') {
      throw new TranscriptionUnavailable(polled.data.error || 'The transcription failed.');
    }
  }

  throw new TranscriptionUnavailable('The transcription took too long. Try a shorter recording.');
}
