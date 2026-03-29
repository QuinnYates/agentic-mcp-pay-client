import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { BudgetTracker } from './budget.js';
import { isPaymentRequired, parsePaymentRequired } from './parser.js';
import type { PaymentSigner } from './signers/interface.js';
import { X402Signer } from './signers/x402.js';
import { StripeSigner } from './signers/stripe.js';
import { MppSigner } from './signers/mpp.js';
import {
  type PaidClientConfig,
  type SpendingStats,
  BudgetExceededError,
  PaymentRejectedError,
} from './types.js';

/**
 * MCP client wrapper that automatically handles paid tool challenges.
 *
 * Wraps the MCP SDK Client, intercepting PAYMENT_REQUIRED responses and
 * transparently signing + retrying with payment credentials.
 */
export class PaidMcpClient {
  private client: Client;
  private budget: BudgetTracker;
  private signers: Map<string, PaymentSigner>;
  private onPaymentRequired?: (info: {
    toolName: string;
    amountCents: number;
    currency: string;
    protocol: string;
  }) => Promise<boolean>;

  constructor(
    clientInfo: { name: string; version: string },
    private config: PaidClientConfig = {},
  ) {
    this.client = new Client(clientInfo);
    this.budget = new BudgetTracker(config.budget ?? {});
    this.signers = new Map();
    this.onPaymentRequired = config.onPaymentRequired;

    // Register signers based on provided credentials
    if (config.walletPrivateKey) {
      const signer = new X402Signer(config.walletPrivateKey);
      this.signers.set(signer.protocol, signer);
    }
    if (config.stripePaymentMethodId) {
      const signer = new StripeSigner(config.stripePaymentMethodId);
      this.signers.set(signer.protocol, signer);
    }
    if (config.mppSessionToken) {
      const signer = new MppSigner(config.mppSessionToken);
      this.signers.set(signer.protocol, signer);
    }
  }

  /**
   * Connect to an MCP server via the given transport.
   */
  async connect(transport: Transport): Promise<void> {
    await this.client.connect(transport);
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * Call a tool on the connected MCP server.
   *
   * If the server responds with PAYMENT_REQUIRED, the client will:
   * 1. Parse the payment challenge
   * 2. Check budget limits (throws BudgetExceededError if over)
   * 3. Call onPaymentRequired callback if set (throws PaymentRejectedError if rejected)
   * 4. Sign with the appropriate protocol signer
   * 5. Retry the call with payment proof
   * 6. Record the spend in the budget tracker
   */
  async callTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    const result = await this.client.callTool(params);

    if (!isPaymentRequired(result)) {
      return result;
    }

    // Parse the payment challenge
    const challenge = parsePaymentRequired(result);
    if (!challenge) {
      return result; // Can't parse — return as-is
    }

    const amountCents = challenge.amount;

    // Check budget
    if (!this.budget.canSpend(amountCents)) {
      // Determine which limit was hit
      if (
        this.config.budget?.maxPerCallCents !== undefined &&
        amountCents > this.config.budget.maxPerCallCents
      ) {
        throw new BudgetExceededError(
          amountCents,
          this.config.budget.maxPerCallCents,
          'per-call',
        );
      }
      if (this.config.budget?.maxDailyCents !== undefined) {
        throw new BudgetExceededError(
          amountCents,
          this.config.budget.maxDailyCents,
          'daily',
        );
      }
      // Fallback (shouldn't happen with current BudgetTracker logic)
      throw new BudgetExceededError(amountCents, 0, 'per-call');
    }

    // Call onPaymentRequired callback
    if (this.onPaymentRequired) {
      const approved = await this.onPaymentRequired({
        toolName: params.name,
        amountCents,
        currency: challenge.currency,
        protocol: challenge.protocol,
      });
      if (!approved) {
        throw new PaymentRejectedError(params.name);
      }
    }

    // Find signer
    const signer = this.signers.get(challenge.protocol);
    if (!signer) {
      throw new Error(
        `No signer configured for protocol: ${challenge.protocol}`,
      );
    }

    // Sign the challenge
    const proof = await signer.sign(challenge);

    // Retry with payment
    const retryResult = await this.client.callTool({
      name: params.name,
      arguments: {
        ...params.arguments,
        _payment: {
          nonce: challenge.nonce,
          proof,
          protocol: challenge.protocol,
        },
      },
    });

    // Record spend
    this.budget.recordSpend(amountCents);

    return retryResult;
  }

  /**
   * Returns current spending statistics.
   */
  getSpendingStats(): SpendingStats {
    return this.budget.getStats();
  }
}
