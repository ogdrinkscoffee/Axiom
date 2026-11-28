/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Custom error class for aborted or timed-out async operations.
 */
export class AsyncTimeoutError extends Error {
  public readonly operationName: string;
  public readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`${operationName} timed out after ${timeoutMs / 1000}s. Please check your network connection and try again.`);
    this.name = 'AsyncTimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Wraps any promise with an enforced timeout.
 * If the upstream promise does not resolve/reject within `timeoutMs`,
 * this rejects immediately with an AsyncTimeoutError so the app never hangs.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 15000,
  operationName = 'Operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        reject(new AsyncTimeoutError(operationName, timeoutMs));
      }
    }, timeoutMs);

    promise
      .then((val) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch((err) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Fetch wrapper with built-in AbortController and timeout enforcement (10s-30s).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const controller = new AbortController();

  let externalSignalUnsub: (() => void) | undefined;
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      init.signal.addEventListener('abort', onAbort, { once: true });
      externalSignalUnsub = () => init.signal?.removeEventListener('abort', onAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new AsyncTimeoutError('Network request', timeoutMs));
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new AsyncTimeoutError('Network request', timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignalUnsub) externalSignalUnsub();
  }
}

/**
 * Translates low-level technical errors, Firebase auth/firestore codes,
 * and JSON-encoded FirestoreErrorInfo strings into clean, actionable user messages.
 */
export function formatUserFacingError(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!error) return fallbackMessage;

  const rawMessage = error instanceof Error ? error.message : String(error);

  // Parse structured Firestore error JSON if present
  if (rawMessage.startsWith('{') && rawMessage.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          return 'Permission denied: Please ensure you are signed in with an authorized account.';
        }
        if (parsed.error.toLowerCase().includes('not-found')) {
          return 'The requested record could not be found.';
        }
        return parsed.error;
      }
    } catch {
      // Fall through to standard regex matching
    }
  }

  // Firebase Auth popup errors
  if (rawMessage.includes('auth/popup-closed-by-user') || rawMessage.includes('cancelled-popup-request')) {
    return 'Sign-in cancelled. The authentication window was closed.';
  }
  if (rawMessage.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
  }
  if (rawMessage.includes('auth/network-request-failed')) {
    return 'Network connection failed. Please check your internet connectivity.';
  }
  if (rawMessage.includes('the client is offline')) {
    return 'You are currently offline. Changes are saved locally and will sync once reconnected.';
  }
  if (rawMessage.includes('permission-denied') || rawMessage.toLowerCase().includes('insufficient permissions')) {
    return 'Permission denied: Access to this workspace or formula is restricted.';
  }
  if (rawMessage.includes('resource-exhausted') || rawMessage.toLowerCase().includes('quota')) {
    return 'Service quota exceeded. Please wait a moment and try again.';
  }
  if (error instanceof AsyncTimeoutError) {
    return error.message;
  }

  return rawMessage.slice(0, 180);
}
