import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request context, carried without threading arguments through call sites.
 *
 * This exists so the LLM layer can tag every OpenRouter call with the user who
 * caused it. Before this, `user` was empty on every row of the OpenRouter
 * activity export, which made spend impossible to attribute — you could see the
 * monthly total but not whose usage produced it.
 *
 * `callClaude`/`callLLM` are reached from ~27 call sites across the routes, so
 * passing a userId parameter down would have meant touching all of them (and
 * every future one). AsyncLocalStorage keeps the plumbing in one place.
 */

interface RequestStore {
  userId?: string;
}

const als = new AsyncLocalStorage<RequestStore>();

/** Wrap a request so anything downstream of it can read/write the store. */
export function runWithRequestContext<T>(fn: () => T): T {
  return als.run({}, fn);
}

/** Called by the auth middleware once the user is known. */
export function setContextUserId(userId: string): void {
  const store = als.getStore();
  if (store) store.userId = userId;
}

/** Undefined for anonymous requests and for work started outside a request. */
export function getContextUserId(): string | undefined {
  return als.getStore()?.userId;
}
