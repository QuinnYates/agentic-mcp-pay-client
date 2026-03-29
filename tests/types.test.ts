import { describe, it, expect } from 'vitest';
import { BudgetExceededError, PaymentRejectedError } from '../src/types.js';

describe('BudgetExceededError', () => {
  it('has correct error name', () => {
    const err = new BudgetExceededError(500, 300, 'per-call');
    expect(err.name).toBe('BudgetExceededError');
  });

  it('message contains requestedCents', () => {
    const err = new BudgetExceededError(500, 300, 'per-call');
    expect(err.message).toContain('500');
  });

  it('message contains limitCents', () => {
    const err = new BudgetExceededError(500, 300, 'per-call');
    expect(err.message).toContain('300');
  });

  it('message contains limitType', () => {
    const err = new BudgetExceededError(500, 300, 'per-call');
    expect(err.message).toContain('per-call');
  });

  it('stores requestedCents and limitCents on instance', () => {
    const err = new BudgetExceededError(500, 300, 'daily');
    expect(err.requestedCents).toBe(500);
    expect(err.limitCents).toBe(300);
    expect(err.limitType).toBe('daily');
  });

  it('is instanceof Error', () => {
    const err = new BudgetExceededError(100, 50, 'daily');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('PaymentRejectedError', () => {
  it('has correct error name', () => {
    const err = new PaymentRejectedError('my-tool');
    expect(err.name).toBe('PaymentRejectedError');
  });

  it('message contains tool name', () => {
    const err = new PaymentRejectedError('my-tool');
    expect(err.message).toContain('my-tool');
  });

  it('stores toolName on instance', () => {
    const err = new PaymentRejectedError('my-tool');
    expect(err.toolName).toBe('my-tool');
  });

  it('is instanceof Error', () => {
    const err = new PaymentRejectedError('my-tool');
    expect(err).toBeInstanceOf(Error);
  });
});
