import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const { handleApiError } = await import('../src/core/error.js');

describe('handleApiError()', () => {

  beforeEach((t) => {
    t.mock.method(console, 'error', () => {});
  });

  afterEach(() => mock.restoreAll());

  it('prints formatted error with code and message', () => {
    handleApiError({ code: 'N42E-5101', message: 'Rate limit exceeded' });

    const out = String(console.error.mock.calls[0].arguments[0]);
    assert.ok(out.includes('Error: 5101'));
    assert.ok(out.includes('Rate limit exceeded'));
    assert.ok(out.includes('View Details'));
  });

  it('prints error without message using documentation fallback', () => {
    handleApiError({ code: 'N42E-9032' });

    const out = String(console.error.mock.calls[0].arguments[0]);
    assert.ok(out.includes('Error: 9032'));
    assert.ok(out.includes('For details, see the documentation'));
  });

  it('handles error without N42E prefix', () => {
    handleApiError({ code: 'UNKNOWN', message: 'Something failed' });

    const out = String(console.error.mock.calls[0].arguments[0]);
    assert.ok(out.includes('Error:'));
    assert.ok(out.includes('Something failed'));
  });

  it('handles error without code', () => {
    handleApiError({ message: 'Generic failure' });

    const out = String(console.error.mock.calls[0].arguments[0]);
    assert.ok(out.includes('Generic failure'));
  });
});