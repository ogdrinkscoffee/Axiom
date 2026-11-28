/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, AsyncTimeoutError, formatUserFacingError } from './asyncResilience';

describe('asyncResilience utilities', () => {
  it('resolves fast promises within timeout window', async () => {
    const fastPromise = new Promise<string>((resolve) => setTimeout(() => resolve('success'), 10));
    const result = await withTimeout(fastPromise, 200, 'Fast Op');
    assert.equal(result, 'success');
  });

  it('rejects with AsyncTimeoutError if promise exceeds timeout', async () => {
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 300));
    await assert.rejects(
      async () => {
        await withTimeout(slowPromise, 40, 'Slow Task');
      },
      (err: unknown) => {
        assert(err instanceof AsyncTimeoutError);
        assert.equal(err.operationName, 'Slow Task');
        assert(err.message.includes('timed out after 0.04s'));
        return true;
      }
    );
  });

  it('formats low-level and Firebase errors into user-friendly messages', () => {
    // 1. Popup closed
    const popupErr = new Error('auth/popup-closed-by-user: The popup was closed.');
    assert.equal(
      formatUserFacingError(popupErr),
      'Sign-in cancelled. The authentication window was closed.'
    );

    // 2. Offline error
    const offlineErr = new Error('Failed to get document because the client is offline.');
    assert.equal(
      formatUserFacingError(offlineErr),
      'You are currently offline. Changes are saved locally and will sync once reconnected.'
    );

    // 3. JSON structured FirestoreErrorInfo
    const structuredJson = JSON.stringify({
      error: 'Missing or insufficient permissions for users/test/formulas',
      operationType: 'create',
      path: 'users/test/formulas',
    });
    assert.equal(
      formatUserFacingError(new Error(structuredJson)),
      'Permission denied: Please ensure you are signed in with an authorized account.'
    );

    // 4. AsyncTimeoutError
    const timeoutErr = new AsyncTimeoutError('Formula Fetch', 15000);
    assert.equal(
      formatUserFacingError(timeoutErr),
      'Formula Fetch timed out after 15s. Please check your network connection and try again.'
    );
  });
});
