import type { PaymentChallenge } from '../types.js';
import type { PaymentSigner } from './interface.js';

/**
 * StripeSigner — pass-through signer.
 * Returns the Stripe PaymentMethod ID as the payment credential.
 */
export class StripeSigner implements PaymentSigner {
  readonly protocol = 'stripe';

  constructor(private readonly paymentMethodId: string) {}

  async sign(_challenge: PaymentChallenge): Promise<string> {
    return this.paymentMethodId;
  }
}
