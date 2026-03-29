import type { PaymentChallenge } from '../types.js';
import type { PaymentSigner } from './interface.js';

/**
 * MppSigner — pass-through signer.
 * Returns the MPP session token as the payment credential.
 */
export class MppSigner implements PaymentSigner {
  readonly protocol = 'mpp';

  constructor(private readonly sessionToken: string) {}

  async sign(_challenge: PaymentChallenge): Promise<string> {
    return this.sessionToken;
  }
}
