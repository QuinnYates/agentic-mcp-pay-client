import { createHmac } from 'node:crypto';
import type { PaymentChallenge } from '../types.js';
import type { PaymentSigner } from './interface.js';

/**
 * X402Signer — HMAC-SHA256 signs the canonical challenge payload.
 *
 * The signed payload is a deterministic JSON string of the fields:
 * nonce, amount, currency, payTo, network, token.
 * Returns a lowercase hex digest.
 */
export class X402Signer implements PaymentSigner {
  readonly protocol = 'x402';

  constructor(private readonly privateKey: string) {}

  async sign(challenge: PaymentChallenge): Promise<string> {
    const payload = JSON.stringify({
      nonce: challenge.nonce,
      amount: challenge.amount,
      currency: challenge.currency,
      payTo: challenge.payTo,
      network: challenge.network ?? null,
      token: challenge.token ?? null,
    });

    return createHmac('sha256', this.privateKey)
      .update(payload)
      .digest('hex');
  }
}
