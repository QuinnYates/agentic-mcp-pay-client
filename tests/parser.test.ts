import { describe, it, expect } from 'vitest';
import { isPaymentRequired, parsePaymentRequired } from '../src/parser.js';
import type { PaymentChallenge } from '../src/types.js';

// Helpers to construct MCP-style tool results
function makeErrorResult(code: string, data?: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ code, ...(data ? { data } : {}) }),
      },
    ],
  };
}

function makeSuccessResult(text: string) {
  return {
    isError: false,
    content: [{ type: 'text', text }],
  };
}

const validChallenge: PaymentChallenge = {
  version: '1',
  protocol: 'x402',
  amount: 100,
  currency: 'USD',
  nonce: 'abc123',
  payTo: '0xDeadBeef',
  network: 'base-sepolia',
  token: '0xToken',
  expiresAt: '2026-12-31T00:00:00Z',
};

describe('isPaymentRequired', () => {
  it('returns true for PAYMENT_REQUIRED error result', () => {
    const result = makeErrorResult('PAYMENT_REQUIRED', validChallenge);
    expect(isPaymentRequired(result)).toBe(true);
  });

  it('returns false for normal (non-error) result', () => {
    const result = makeSuccessResult('some tool output');
    expect(isPaymentRequired(result)).toBe(false);
  });

  it('returns false for error result with different code', () => {
    const result = makeErrorResult('TOOL_NOT_FOUND');
    expect(isPaymentRequired(result)).toBe(false);
  });

  it('returns false for error result with no content', () => {
    const result = { isError: true, content: [] };
    expect(isPaymentRequired(result)).toBe(false);
  });

  it('returns false for error result with non-JSON text', () => {
    const result = { isError: true, content: [{ type: 'text', text: 'not json' }] };
    expect(isPaymentRequired(result)).toBe(false);
  });
});

describe('parsePaymentRequired', () => {
  it('extracts all PaymentChallenge fields', () => {
    const result = makeErrorResult('PAYMENT_REQUIRED', validChallenge);
    const parsed = parsePaymentRequired(result);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe('1');
    expect(parsed!.protocol).toBe('x402');
    expect(parsed!.amount).toBe(100);
    expect(parsed!.currency).toBe('USD');
    expect(parsed!.nonce).toBe('abc123');
    expect(parsed!.payTo).toBe('0xDeadBeef');
    expect(parsed!.network).toBe('base-sepolia');
    expect(parsed!.token).toBe('0xToken');
    expect(parsed!.expiresAt).toBe('2026-12-31T00:00:00Z');
  });

  it('returns null for normal (non-error) result', () => {
    const result = makeSuccessResult('ok');
    expect(parsePaymentRequired(result)).toBeNull();
  });

  it('returns null for error result with different code', () => {
    const result = makeErrorResult('ACCESS_DENIED');
    expect(parsePaymentRequired(result)).toBeNull();
  });

  it('returns null for non-JSON content', () => {
    const result = { isError: true, content: [{ type: 'text', text: 'not json' }] };
    expect(parsePaymentRequired(result)).toBeNull();
  });

  it('works with minimal required fields (no optional fields)', () => {
    const minimal: PaymentChallenge = {
      version: '1',
      protocol: 'mpp',
      amount: 50,
      currency: 'USD',
      nonce: 'nonce1',
      payTo: 'stripe:pm_test_xyz',
    };
    const result = makeErrorResult('PAYMENT_REQUIRED', minimal);
    const parsed = parsePaymentRequired(result);
    expect(parsed).not.toBeNull();
    expect(parsed!.network).toBeUndefined();
    expect(parsed!.token).toBeUndefined();
    expect(parsed!.expiresAt).toBeUndefined();
  });
});
