// Types and error classes for agentic-mcp-pay-client

export interface BudgetConfig {
  maxPerCallCents?: number;
  maxDailyCents?: number;
}

export interface PaidClientConfig {
  walletPrivateKey?: string;
  stripePaymentMethodId?: string;
  mppSessionToken?: string;
  budget?: BudgetConfig;
  onPaymentRequired?: (info: PaymentInfo) => Promise<boolean>;
}

export interface PaymentInfo {
  toolName: string;
  amountCents: number;
  currency: string;
  protocol: string;
}

export interface PaymentChallenge {
  version: string;
  protocol: string;
  amount: number;
  currency: string;
  nonce: string;
  payTo: string;
  network?: string;
  token?: string;
  expiresAt?: string;
}

export interface SpendingStats {
  totalCents: number;
  todayCents: number;
  callCount: number;
}

export class BudgetExceededError extends Error {
  readonly requestedCents: number;
  readonly limitCents: number;
  readonly limitType: 'per-call' | 'daily';

  constructor(requestedCents: number, limitCents: number, limitType: 'per-call' | 'daily') {
    super(
      `Budget exceeded: requested ${requestedCents} cents exceeds ${limitType} limit of ${limitCents} cents`
    );
    this.name = 'BudgetExceededError';
    this.requestedCents = requestedCents;
    this.limitCents = limitCents;
    this.limitType = limitType;
  }
}

export class PaymentRejectedError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Payment rejected for tool: ${toolName}`);
    this.name = 'PaymentRejectedError';
    this.toolName = toolName;
  }
}
