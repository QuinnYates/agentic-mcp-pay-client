import { describe, it, expect } from 'vitest';
import { X402Signer } from '../src/signers/x402.js';
import { StripeSigner } from '../src/signers/stripe.js';
import { MppSigner } from '../src/signers/mpp.js';
import type { PaymentChallenge } from '../src/types.js';

const challenge: PaymentChallenge = {
  version: '1',
  protocol: 'x402',
  amount: 100,
  currency: 'USD',
  nonce: 'abc123nonce',
  payTo: '0xPayAddress',
  network: 'base-sepolia',
  token: '0xTokenAddr',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe('X402Signer', () => {
  it('produces a non-empty hex string', async () => {
    const signer = new X402Signer('my-secret-key');
    const result = await signer.sign(challenge);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // hex string: only 0-9 and a-f
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('has protocol "x402"', () => {
    const signer = new X402Signer('key');
    expect(signer.protocol).toBe('x402');
  });

  it('produces deterministic output for the same input', async () => {
    const signer = new X402Signer('my-secret-key');
    const r1 = await signer.sign(challenge);
    const r2 = await signer.sign(challenge);
    expect(r1).toBe(r2);
  });
});

describe('StripeSigner', () => {
  it('returns the PaymentMethod ID as-is', async () => {
    const signer = new StripeSigner('pm_test_abc123');
    const result = await signer.sign(challenge);
    expect(result).toBe('pm_test_abc123');
  });

  it('has protocol "stripe"', () => {
    const signer = new StripeSigner('pm_test_abc123');
    expect(signer.protocol).toBe('stripe');
  });
});

describe('MppSigner', () => {
  it('returns the session token as-is', async () => {
    const signer = new MppSigner('sess_token_xyz');
    const result = await signer.sign(challenge);
    expect(result).toBe('sess_token_xyz');
  });

  it('has protocol "mpp"', () => {
    const signer = new MppSigner('sess_token_xyz');
    expect(signer.protocol).toBe('mpp');
  });
});
