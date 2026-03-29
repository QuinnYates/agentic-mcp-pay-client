import type { PaymentChallenge } from '../types.js';

export interface PaymentSigner {
  protocol: string;
  sign(challenge: PaymentChallenge): Promise<string>;
}
