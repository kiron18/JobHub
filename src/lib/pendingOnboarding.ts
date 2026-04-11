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
