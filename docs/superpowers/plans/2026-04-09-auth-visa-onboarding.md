# Auth, Visa Status & Citizenship Warning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken auth loop by deferring account creation to Step 5, add visa status to the intake form, add a citizenship warning modal in MatchEngine, overhaul AuthPage to remove magic link, and add sign-out buttons throughout.

**Architecture:** All onboarding answers stay in React state through Steps 0–4 (no Supabase session). Step 5 creates a real account (email+password or Google OAuth); on success, `POST /onboarding/submit` fires with the real JWT. Google OAuth persists answers to localStorage and files to IndexedDB before leaving the page, and `OnboardingGate` restores them on return. `citizenshipWarning` is computed server-side in `analyze.ts` by comparing `profile.visaStatus` against `australianFlags.requiresCitizenship`.

**Tech Stack:** React 18, TypeScript, Supabase JS, Framer Motion, Prisma (PostgreSQL), Express

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `server/prisma/schema.prisma` | Modify | Add `visaStatus String?` to `CandidateProfile` |
| `server/src/routes/onboarding.ts` | Modify | Accept and store `visaStatus` |
| `server/src/routes/analyze.ts` | Modify | Compute and return `citizenshipWarning` |
| `src/lib/pendingOnboarding.ts` | **Create** | localStorage + IndexedDB helpers for Google OAuth resume |
| `src/components/OnboardingIntake.tsx` | Modify | Add visa field, `StepAuth`, remove email from `StepFiles`, defer submit, sign-out button |
| `src/components/OnboardingGate.tsx` | Modify | Detect resume mode after Google OAuth redirect |
| `src/pages/AuthPage.tsx` | Modify | Remove magic link, add Google OAuth, sign-out for authenticated users |
| `src/components/MatchEngine.tsx` | Modify | `citizenshipWarning` field + `CitizenshipWarning` modal |

---

## Task 1: Database — add visaStatus column

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add field to schema**

In `server/prisma/schema.prisma`, after the `marketingEmailSent` line (line ~47), add:

```prisma
  visaStatus          String?
```

The `CandidateProfile` model block (relevant section only) should now read:
```prisma
  marketingEmail      String?
  marketingConsent    Boolean  @default(false)
  marketingEmailSent  Boolean  @default(false)
  visaStatus          String?
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name add_visa_status
```

Expected output: `The following migration(s) have been created and applied: migrations/..._add_visa_status`

- [ ] **Step 3: Verify Prisma client generated**

```bash
cd server && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add visaStatus to CandidateProfile"
```

---

## Task 2: Backend onboarding — store visaStatus

**Files:**
- Modify: `server/src/routes/onboarding.ts:63-99`

- [ ] **Step 1: Add visaStatus to both create and update blocks**

In `server/src/routes/onboarding.ts`, in the `prisma.candidateProfile.upsert` call, add `visaStatus` to both `create` and `update`:

In the `create` block (after `marketingConsent` on ~line 81), add:
```ts
          visaStatus: (answers as any).visaStatus ?? null,
```

In the `update` block (after `marketingConsent` on ~line 98), add:
```ts
          visaStatus: (answers as any).visaStatus ?? null,
```

- [ ] **Step 2: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/onboarding.ts
git commit -m "feat(onboarding): store visaStatus from intake answers"
```

---

## Task 3: Backend analyze — compute citizenshipWarning

**Files:**
- Modify: `server/src/routes/analyze.ts:107-169`

- [ ] **Step 1: Compute citizenshipWarning after australianFlags**

In `server/src/routes/analyze.ts`, after the `australianFlags` assignment (~line 107–112), add:

```ts
        const citizenshipWarning: boolean =
            australianFlags.requiresCitizenship === true &&
            (profile as any).visaStatus !== 'Australian Citizen';
```

- [ ] **Step 2: Add citizenshipWarning to the response**

In the `res.json(...)` call (~line 152), add `citizenshipWarning` to the response object:

```ts
        res.json({
            jobApplicationId: jobApplication?.id ?? null,
            matchScore: computedMatchScore,
            overallGrade: overallGrade ?? null,
            dimensions: dimensions ?? null,
            matchedIdentityCard,
            australianFlags,
            citizenshipWarning,
            keywords: analysis.keywords || [],
            analysisTone: analysis.analysisTone || 'Professional',
            requiresSelectionCriteria: !!analysis.requiresSelectionCriteria,
            coreCompetencies: analysis.coreCompetencies || [],
            extractedMetadata: { company, role },
            rankedAchievements: finalRanked,
            hasSufficientEvidence,
            evidenceWarning: hasSufficientEvidence
                ? null
                : "You have fewer than 3 'Strong' matched achievements. Consider adding more specific metrics to your profile for a better match."
        });
```

- [ ] **Step 3: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/analyze.ts
git commit -m "feat(analyze): compute and return citizenshipWarning"
```

---

## Task 4: Frontend — pendingOnboarding utilities

**Files:**
- Create: `src/lib/pendingOnboarding.ts`

- [ ] **Step 1: Create the utility file**

Create `src/lib/pendingOnboarding.ts` with this complete content:

```ts
/**
 * Helpers for persisting onboarding state across Google OAuth redirects.
 * Text answers go to localStorage; File objects go to IndexedDB (binary safe).
 */

const DB_NAME = 'jobhub_pending';
const STORE_NAME = 'files';
const DB_VERSION = 1;
const ANSWERS_KEY = 'jobhub_pending_onboarding';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFilesToIDB(files: {
  resume: File;
  cl1: File | null;
  cl2: File | null;
}): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  store.put(
    { buffer: await files.resume.arrayBuffer(), name: files.resume.name, type: files.resume.type },
    'resume'
  );
  if (files.cl1) {
    store.put(
      { buffer: await files.cl1.arrayBuffer(), name: files.cl1.name, type: files.cl1.type },
      'cl1'
    );
  }
  if (files.cl2) {
    store.put(
      { buffer: await files.cl2.arrayBuffer(), name: files.cl2.name, type: files.cl2.type },
      'cl2'
    );
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFilesFromIDB(): Promise<{
  resume: File | null;
  cl1: File | null;
  cl2: File | null;
}> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  function getFile(key: string): Promise<File | null> {
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        if (!req.result) { resolve(null); return; }
        resolve(new File([req.result.buffer], req.result.name, { type: req.result.type }));
      };
      req.onerror = () => resolve(null);
    });
  }

  const [resume, cl1, cl2] = await Promise.all([
    getFile('resume'),
    getFile('cl1'),
    getFile('cl2'),
  ]);
  return { resume, cl1, cl2 };
}

export async function clearPendingFilesFromIDB(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
}

export function savePendingAnswers(answers: object): void {
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
}

export function loadPendingAnswers(): Record<string, unknown> | null {
  const raw = localStorage.getItem(ANSWERS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function hasPendingOnboarding(): boolean {
  return !!localStorage.getItem(ANSWERS_KEY);
}

export function clearPendingAnswers(): void {
  localStorage.removeItem(ANSWERS_KEY);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pendingOnboarding.ts
git commit -m "feat(lib): add IndexedDB + localStorage helpers for Google OAuth resume"
```

---

## Task 5: OnboardingIntake — visa status field in StepRole

**Files:**
- Modify: `src/components/OnboardingIntake.tsx`

- [ ] **Step 1: Add VISA_STATUS_OPTIONS constant and visaStatus to IntakeAnswers**

In `OnboardingIntake.tsx`, add `visaStatus: string` to the `IntakeAnswers` interface:

```ts
interface IntakeAnswers {
  targetRole: string; targetCity: string;
  seniority: string; industry: string;
  visaStatus: string;          // ← ADD THIS
  searchDuration: string; applicationsCount: string;
  channels: string[]; channelOther: string;
  responsePattern: string;
  blockerOptions: string[]; blockerOther: string;
  perceivedBlocker: string;
  marketingEmail: string;
  marketingConsent: boolean;
}
```

Add the constant after `INDUSTRY_OPTIONS`:

```ts
const VISA_STATUS_OPTIONS = [
  'Australian Citizen',
  'Permanent Resident',
  'Skilled Visa (482 / 186 / 189 / 190)',
  'Working Holiday Visa',
  'Student Visa',
  'Other / Not specified',
];
```

- [ ] **Step 2: Initialize visaStatus in default state**

In `OnboardingIntake`, update the initial `answers` state:

```ts
  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '',
    visaStatus: '',                // ← ADD THIS
    searchDuration: '', applicationsCount: '', channels: [],
    channelOther: '', responsePattern: '',
    blockerOptions: [], blockerOther: '', perceivedBlocker: '',
    marketingEmail: '',
    marketingConsent: false,
  });
```

- [ ] **Step 3: Add visa status field to StepRole**

In the `StepRole` function, update the `valid` check and add the field. Replace the existing `valid` line and add the new field at the bottom of the form:

```ts
  const valid = answers.targetRole.trim() && answers.targetCity.trim() && answers.seniority && answers.industry && answers.visaStatus;
```

Add after the Industry field, before the button row:

```tsx
        <Field label="Work rights in Australia">
          <TSelect
            value={answers.visaStatus}
            onChange={v => onChange('visaStatus', v)}
            options={VISA_STATUS_OPTIONS}
            placeholder="Select your visa status"
          />
        </Field>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): add visa status field to StepRole"
```

---

## Task 6: OnboardingIntake — remove email field from StepFiles

**Files:**
- Modify: `src/components/OnboardingIntake.tsx`

The spec keeps marketing consent on Step 4 but removes the email input (email is captured in the new StepAuth at Step 5).

- [ ] **Step 1: Remove email input from StepFiles**

In the `StepFiles` function signature, remove `marketingEmail` and `onMarketingEmailChange`:

```ts
function StepFiles({ resume, setResume, cl1, setCl1, cl2, setCl2, onNext, submitting, onBack, marketingConsent, onMarketingConsentChange }: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onNext: () => void; submitting: boolean; onBack: () => void;
  marketingConsent: boolean;
  onMarketingConsentChange: (v: boolean) => void;
}) {
```

Note `onSubmit` is renamed to `onNext` since actual submission now happens in StepAuth.

- [ ] **Step 2: Replace StepFiles body**

Replace the entire `StepFiles` function body (the `return (...)`) with:

```tsx
  const { T } = useTheme();
  return (
    <div>
      <ProfileProgress step={4} answers={{ targetRole: '', targetCity: '', seniority: '', industry: '', visaStatus: '', searchDuration: '', applicationsCount: '', channels: [], channelOther: '', responsePattern: '', blockerOptions: [], blockerOther: '', perceivedBlocker: '', marketingEmail: '', marketingConsent: true }} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Now show us what you've been sending out.
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We're not judging the documents. We're using them to understand how you've been positioning yourself.
      </p>
      <p style={{ color: T.textFaint, fontSize: 12, marginBottom: 20 }}>PDF or Word accepted.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FileDropZone label="Your resume" required file={resume} onFile={setResume} />
        <FileDropZone label="A recent cover letter" subtext="If you don't have one, that's useful information too." file={cl1} onFile={setCl1} />
        <FileDropZone label="Another cover letter if you have it" file={cl2} onFile={setCl2} />
      </div>

      {/* Marketing consent only — email captured in StepAuth */}
      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={e => onMarketingConsentChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: T.btnBg, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: T.textMuted }}>
            Send me job search tips and product updates
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} disabled={submitting} />
        <PrimaryButton
          onClick={onNext}
          disabled={!resume || submitting}
          label="Next"
        />
      </div>
    </div>
  );
```

- [ ] **Step 3: Commit**

```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): remove email from StepFiles, move to StepAuth"
```

---

## Task 7: OnboardingIntake — add StepAuth component

**Files:**
- Modify: `src/components/OnboardingIntake.tsx`

- [ ] **Step 1: Add imports**

At the top of `OnboardingIntake.tsx`, add these imports alongside existing ones:

```ts
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  savePendingAnswers, saveFilesToIDB,
  loadPendingAnswers, loadFilesFromIDB,
  clearPendingAnswers, clearPendingFilesFromIDB,
  hasPendingOnboarding,
} from '../lib/pendingOnboarding';
```

- [ ] **Step 2: Add buildFinalAnswers helper function**

Add this helper function before the `OnboardingIntake` main component (after the `CheckBox` component):

```ts
function buildFinalAnswers(answers: IntakeAnswers) {
  const blockerParts = answers.blockerOptions.filter(b => b !== 'Other');
  if (answers.blockerOptions.includes('Other') && answers.blockerOther.trim()) {
    blockerParts.push(answers.blockerOther.trim());
  }
  return {
    ...answers,
    perceivedBlocker: blockerParts.join('; '),
    channels: answers.channels.includes('Other') && answers.channelOther.trim()
      ? [...answers.channels.filter(c => c !== 'Other'), `Other: ${answers.channelOther.trim()}`]
      : answers.channels,
  };
}
```

- [ ] **Step 3: Add StepAuth component**

Add the `StepAuth` component before the `OnboardingIntake` main component:

```tsx
function StepAuth({ answers, resume, cl1, cl2, onAuthSuccess, submitting, onBack }: {
  answers: IntakeAnswers;
  resume: File | null;
  cl1: File | null;
  cl2: File | null;
  onAuthSuccess: () => void;
  submitting: boolean;
  onBack: () => void;
}) {
  const { T } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setAlreadyRegistered(false);
    if (password.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered')) {
          setAlreadyRegistered(true);
        } else {
          toast.error(error.message || 'Sign up failed');
        }
        return;
      }
      onAuthSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!resume) { toast.error('Resume file is missing — go back and upload it'); return; }
    try {
      const finalAnswers = buildFinalAnswers(answers);
      savePendingAnswers(finalAnswers);
      await saveFilesToIDB({ resume, cl1, cl2 });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        clearPendingAnswers();
        toast.error(error.message || 'Google sign-in failed');
      }
    } catch (err: any) {
      clearPendingAnswers();
      toast.error(err.message || 'Google sign-in failed');
    }
  }

  const inputStyle: React.CSSProperties = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 12, color: T.inputText, fontSize: 15,
    padding: '12px 16px', width: '100%', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div>
      <ProfileProgress step={4} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Last step — create your account
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        Your diagnosis report will be sent to this email. Use one you actually check — we don't send spam.
      </p>

      {/* Google OAuth */}
      <motion.button
        onClick={handleGoogle}
        disabled={loading || submitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: '100%', padding: '13px 20px', borderRadius: 14, border: `1px solid ${T.cardBorder}`,
          background: T.card, color: T.text, fontWeight: 700, fontSize: 15,
          cursor: loading || submitting ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 8, fontFamily: 'inherit',
          opacity: loading || submitting ? 0.5 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </motion.button>
      <p style={{ fontSize: 11, color: T.textFaint, marginBottom: 20, textAlign: 'center' }}>
        With Google, your report goes to your Google account email.
      </p>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
        <span style={{ fontSize: 12, color: T.textFaint, fontWeight: 600 }}>or</span>
        <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
      </div>

      {/* Email + Password form */}
      <form onSubmit={handleSignUp}>
        <div style={{ marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textFaint, marginBottom: 8 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setAlreadyRegistered(false); }}
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textFaint, marginBottom: 8 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(''); }}
            placeholder="Minimum 8 characters"
            required
            style={inputStyle}
          />
          {pwError && (
            <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{pwError}</p>
          )}
        </div>

        {alreadyRegistered && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 14 }}
          >
            <p style={{ fontSize: 13, color: '#fcd34d', margin: 0 }}>
              This email already has an account.{' '}
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0 }}
              >
                Sign in instead.
              </button>
            </p>
          </motion.div>
        )}

        <PrimaryButton
          onClick={() => {}}
          disabled={loading || submitting || !email.trim() || !password}
          label={loading || submitting ? 'Creating account...' : 'Create account & build diagnosis'}
        />
      </form>

      <div style={{ marginTop: 16 }}>
        <BackButton onBack={onBack} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): add StepAuth with email+password and Google OAuth"
```

---

## Task 8: OnboardingIntake — wire up new flow in main component

**Files:**
- Modify: `src/components/OnboardingIntake.tsx`

- [ ] **Step 1: Add resumeMode prop and useAuth import to OnboardingIntake**

Change the component signature:

```tsx
export function OnboardingIntake({ resumeMode = false }: { resumeMode?: boolean }) {
```

Add `useAuth` and `useNavigate` usage at the top of the component body:

```ts
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
```

- [ ] **Step 2: Refactor handleSubmit to doSubmit**

Replace the existing `handleSubmit` with a `doSubmit` function that accepts arguments (so it can be called both from StepAuth and from resume mode):

```ts
  const doSubmit = async (
    finalAnswers: ReturnType<typeof buildFinalAnswers>,
    resumeFile: File,
    coverLetter1: File | null,
    coverLetter2: File | null
  ) => {
    setSubmitting(true);

    const formData = new FormData();
    formData.append('answers', JSON.stringify(finalAnswers));
    formData.append('resume', resumeFile);
    if (coverLetter1) formData.append('coverLetter1', coverLetter1);
    if (coverLetter2) formData.append('coverLetter2', coverLetter2);

    try {
      await api.post('/onboarding/submit', formData, { timeout: 30000 });
      clearPendingAnswers();
      clearPendingFilesFromIDB().catch(() => {});
      setStep(6);
    } catch (err) {
      console.error('[OnboardingIntake] Submit failed:', err);
      toast.error('Something went wrong uploading your files. Please try again.');
      setSubmitting(false);
    }
  };

  const handleAuthSuccess = () => {
    if (!resume) return;
    const finalAnswers = buildFinalAnswers(answers);
    doSubmit(finalAnswers, resume, cl1, cl2);
  };
```

- [ ] **Step 3: Add resume mode useEffect**

Add this effect inside `OnboardingIntake`, after the existing useEffect:

```ts
  useEffect(() => {
    if (!resumeMode) return;
    async function loadAndSubmit() {
      setSubmitting(true);
      const pendingAnswers = loadPendingAnswers();
      const pendingFiles = await loadFilesFromIDB();
      if (!pendingAnswers || !pendingFiles.resume) {
        toast.error('Could not restore your session. Please start again.');
        setSubmitting(false);
        return;
      }
      setAnswers(pendingAnswers as IntakeAnswers);
      await doSubmit(
        pendingAnswers as ReturnType<typeof buildFinalAnswers>,
        pendingFiles.resume,
        pendingFiles.cl1,
        pendingFiles.cl2
      );
    }
    loadAndSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode]);
```

- [ ] **Step 4: Update STEPS array and ProcessingScreen step**

Replace the existing `STEPS` array:

```ts
  const STEPS = [
    <StepWelcome key="welcome" onNext={goNext} />,
    <StepRole key="role" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepTimeline key="timeline" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepResponses key="responses" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepFiles
      key="files"
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onNext={goNext}
      submitting={submitting}
      onBack={goBack}
      marketingConsent={answers.marketingConsent}
      onMarketingConsentChange={v => setAnswers(prev => ({ ...prev, marketingConsent: v }))}
    />,
    <StepAuth
      key="auth"
      answers={answers}
      resume={resume}
      cl1={cl1}
      cl2={cl2}
      onAuthSuccess={handleAuthSuccess}
      submitting={submitting}
      onBack={goBack}
    />,
  ];
```

Replace `if (step === 5)` with `if (step === 6 || (resumeMode && submitting))`:

```ts
  if (step === 6 || (resumeMode && submitting)) {
    return (
      <div style={{ backgroundColor: T.bg, minHeight: '100vh', transition: 'background-color 0.4s' }}>
        <Scene />
        <ThemeToggle dark={isDark} onToggle={toggleDark} />
        <ProcessingScreen
          isDark={isDark}
          theme={T}
          email={answers.marketingEmail?.trim() ?? ''}
          onComplete={() => {
            console.log('[OnboardingIntake] onComplete called');
          }}
          onRetry={handleRetry}
        />
      </div>
    );
  }
```

Also update the existing `useEffect` that checks the report status:

```ts
  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING' || data.status === 'FAILED') { setStep(6); }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Add sign-out button to the onboarding wrapper**

In the main `return (...)` of `OnboardingIntake`, add a sign-out button fixed at top-left (next to `ThemeToggle`). Add this after `<ThemeToggle dark={isDark} onToggle={toggleDark} />`:

```tsx
      {user && (
        <motion.button
          onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'fixed', top: 20, left: 20, zIndex: 100,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: T.toggleBg, color: T.textMuted,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            backdropFilter: 'blur(12px)',
          }}
          title="Sign out"
        >
          <LogOut size={14} />
          Sign out
        </motion.button>
      )}
```

Also add it to the `ProcessingScreen` wrapper (the `step === 6` block), after `<ThemeToggle>`:

```tsx
        {user && (
          <motion.button
            onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
            style={{
              position: 'fixed', top: 20, left: 20, zIndex: 100,
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: T.toggleBg, color: T.textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: 6, fontSize: 12, fontWeight: 600,
              backdropFilter: 'blur(12px)',
            }}
          >
            <LogOut size={14} />
            Sign out
          </motion.button>
        )}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/OnboardingIntake.tsx
git commit -m "feat(onboarding): defer auth to StepAuth, add resume mode, sign-out button"
```

---

## Task 9: OnboardingGate — detect Google OAuth resume mode

**Files:**
- Modify: `src/components/OnboardingGate.tsx`

- [ ] **Step 1: Import hasPendingOnboarding**

Add import at the top of `OnboardingGate.tsx`:

```ts
import { hasPendingOnboarding } from '../lib/pendingOnboarding';
```

- [ ] **Step 2: Pass resumeMode to OnboardingIntake**

In `OnboardingGate.tsx`, replace the existing fallback render:

```tsx
  // API error or no profile row yet — show onboarding
  if (isError || !profile?.hasCompletedOnboarding) {
    // If user is authenticated and we have pending data (from Google OAuth redirect),
    // show OnboardingIntake in resume mode so it auto-submits.
    const resumeMode = !!user && hasPendingOnboarding();
    return <OnboardingIntake resumeMode={resumeMode} />;
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/OnboardingGate.tsx
git commit -m "feat(gate): detect Google OAuth resume mode, pass to OnboardingIntake"
```

---

## Task 10: AuthPage — remove magic link, add Google OAuth, sign-out for authenticated users

**Files:**
- Modify: `src/pages/AuthPage.tsx`

Replace the entire `AuthPage.tsx` with this complete rewrite:

- [ ] **Step 1: Write new AuthPage**

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Loader2, Lock, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

export const AuthPage: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // If user is already authenticated and has a profile, redirect them home.
  // We do NOT auto-redirect here so users can explicitly sign out if they need to.

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!isSignup) navigate('/', { replace: true });
      else toast.success('Check your email to confirm your account');
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, fontSize: 15, color: '#f1f5f9', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
    background: disabled ? 'rgba(99,102,241,0.3)' : '#6366f1',
    color: 'white', fontSize: 15, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.12) 0%, #020617 60%)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16, marginBottom: 20,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
          }}>
            <Lock size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Sign in to JobHub
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {isSignup ? 'Create a new account' : 'Welcome back'}
          </p>
        </div>

        {/* Already signed in panel */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 20, marginBottom: 20, backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#a5b4fc" />
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Signed in as</p>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{user.email}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/', { replace: true })}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Go to app
              </button>
              <button
                onClick={async () => { await signOut(); }}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}

        <div style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)',
        }}>
          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: '#f1f5f9',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 8, opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key="password"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <form onSubmit={handlePassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading
                    ? <Loader2 size={18} className="animate-spin" />
                    : <><Lock size={16} />{isSignup ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></>}
                </button>
              </form>
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#475569' }}>
                {isSignup ? 'Already have an account?' : "Don't have an account yet?"}
                {' '}
                <button onClick={() => setIsSignup(s => !s)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {isSignup ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#334155' }}>
          New user?{' '}
          <button
            onClick={() => {
              localStorage.removeItem('jobhub_auth_email');
              localStorage.removeItem('jobhub_report_seen');
              navigate('/');
            }}
            style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Start fresh →
          </button>
        </p>
      </motion.div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat(auth): remove magic link, add Google OAuth, sign-out panel for authenticated users"
```

---

## Task 11: MatchEngine — CitizenshipWarning modal

**Files:**
- Modify: `src/components/MatchEngine.tsx`

- [ ] **Step 1: Add citizenshipWarning to AnalysisResult type**

In `MatchEngine.tsx`, update the `AnalysisResult` interface (after `australianFlags`):

```ts
interface AnalysisResult {
    matchScore: number;
    keywords: string[];
    rankedAchievements: Array<{
        id: string;
        relevanceScore: number;
        reason: string;
        tier: 'STRONG' | 'MODERATE' | 'WEAK';
    }>;
    extractedMetadata?: {
        company: string;
        role: string;
    };
    evidenceWarning?: string;
    requiresSelectionCriteria?: boolean;
    overallGrade?: string;
    dimensions?: Record<string, { score: number; grade: string; note: string }>;
    matchedIdentityCard?: string | null;
    citizenshipWarning?: boolean;          // ← ADD THIS
    australianFlags?: {
        apsLevel: string | null;
        requiresCitizenship: boolean;
        securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
        salaryType: 'base' | 'trp' | 'unknown';
    };
}
```

- [ ] **Step 2: Add state variable for citizenship warning**

In the `MatchEngine` component, add state after `showLowMatchWarning`:

```ts
    const [showCitizenshipWarning, setShowCitizenshipWarning] = useState(false);
```

- [ ] **Step 3: Trigger citizenship warning after analysis**

In `handleAnalyze`, after `setResult(data)`:

```ts
            setResult(data);
            localStorage.setItem('jobhub_current_analysis', JSON.stringify(data));
            if (data.citizenshipWarning) {
                setShowCitizenshipWarning(true);
            }
```

- [ ] **Step 4: Add CitizenshipWarning component**

Add the `CitizenshipWarning` component before `MatchEngine` (after `LowMatchWarning`):

```tsx
interface CitizenshipWarningProps {
    onClose: () => void;
    onProceed: () => void;
}

const CitizenshipWarning: React.FC<CitizenshipWarningProps> = ({ onClose, onProceed }) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-900/30 overflow-hidden"
                >
                    {/* Amber gradient header */}
                    <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 p-8 pb-6 border-b border-amber-500/20">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0">
                                <AlertTriangle size={28} className="text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-amber-300">This role requires Australian citizenship.</h2>
                                <p className="text-sm text-amber-400/70 mt-0.5">Hard boundary — not a preference</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Citizenship requirements are hard boundaries. Regardless of your qualifications or experience,
                            applications from non-citizens are rejected at the screening stage. Your time is better spent
                            on roles open to your visa status.
                        </p>

                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                            >
                                <ArrowLeft size={16} />
                                Find a better role
                            </button>
                            <button
                                onClick={onProceed}
                                className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors"
                            >
                                Proceed anyway — I understand
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
```

- [ ] **Step 5: Render CitizenshipWarning in MatchEngine JSX**

In the `MatchEngine` component return, add `CitizenshipWarning` alongside `LowMatchWarning`:

```tsx
        <>
            {showCitizenshipWarning && (
                <CitizenshipWarning
                    onClose={() => setShowCitizenshipWarning(false)}
                    onProceed={() => setShowCitizenshipWarning(false)}
                />
            )}
            {showLowMatchWarning && result && (
                <LowMatchWarning ... />
            )}
            ...
        </>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd E:/AntiGravity/JobHub && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/MatchEngine.tsx
git commit -m "feat(match-engine): add CitizenshipWarning modal for citizenship-required roles"
```

---

## Self-Review — Spec Coverage Check

| Spec requirement | Task covering it |
|---|---|
| Move account creation to end of onboarding | Tasks 6, 7, 8 |
| No anonymous session created | Task 8 (removed `updateUser`, no anon init) |
| Visa status question on Step 1 | Task 5 |
| All 6 visa options | Task 5 |
| visaStatus stored in DB | Tasks 1, 2 |
| Step 5 = email+password or Google OAuth | Task 7 |
| Google OAuth persists to localStorage + IndexedDB | Tasks 4, 7 |
| OnboardingGate resume mode after redirect | Task 9 |
| Clear localStorage/IndexedDB after submit | Tasks 4, 8 |
| "Already registered" error handling | Task 7 |
| Marketing consent on Step 4 (not moved) | Task 6 |
| AuthPage: remove magic link | Task 10 |
| AuthPage: add Google OAuth | Task 10 |
| AuthPage: remove hintEmail auto-send | Task 10 |
| citizenshipWarning computed server-side | Task 3 |
| citizenshipWarning: false when visaStatus is null | Task 3 (null !== 'Australian Citizen' is true — fix needed) |
| CitizenshipWarning modal | Task 11 |
| "Find a better role" + "Proceed anyway" actions | Task 11 |
| Sign-out button | Tasks 8 (onboarding), 10 (AuthPage) |

**Null visaStatus fix (Task 3, Step 1):** The spec says existing users with `visaStatus === null` should NOT get a warning. Fix the compute:

```ts
        const citizenshipWarning: boolean =
            australianFlags.requiresCitizenship === true &&
            profile.visaStatus !== null &&
            (profile as any).visaStatus !== 'Australian Citizen';
```

Update Task 3, Step 1 to use this version.
