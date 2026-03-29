import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { PaidMcpClient } from '../src/client.js';
import { BudgetExceededError, PaymentRejectedError } from '../src/types.js';

// Helper: creates a PAYMENT_REQUIRED error response
function paymentRequiredResponse(amount: number, protocol = 'x402') {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          code: 'PAYMENT_REQUIRED',
          data: {
            version: '1.0',
            protocol,
            amount,
            currency: 'USD',
            nonce: 'test-nonce-123',
            payTo: '0xRecipient',
            network: 'base-sepolia',
          },
        }),
      },
    ],
  };
}

// Creates a mock MCP server with paid/free/expensive tools
function createMockServer(): McpServer {
  const server = new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // Free tool — always returns immediately
  server.tool('free-tool', 'A free tool', { input: z.string().optional() }, async () => ({
    content: [{ type: 'text', text: 'free-result' }],
  }));

  // Paid tool — returns PAYMENT_REQUIRED on first call, succeeds on retry with _payment
  server.tool(
    'paid-tool',
    'A paid tool',
    { query: z.string().optional(), _payment: z.any().optional() },
    async (args) => {
      if (args._payment) {
        return {
          content: [{ type: 'text', text: 'paid-result' }],
        };
      }
      return paymentRequiredResponse(500);
    },
  );

  // Expensive tool — always returns PAYMENT_REQUIRED with high amount
  server.tool(
    'expensive-tool',
    'An expensive tool',
    { _payment: z.any().optional() },
    async (args) => {
      if (args._payment) {
        return {
          content: [{ type: 'text', text: 'expensive-result' }],
        };
      }
      return paymentRequiredResponse(10000);
    },
  );

  return server;
}

async function setupPair(config: Parameters<typeof PaidMcpClient['prototype']['constructor']> extends never[] ? never : ConstructorParameters<typeof PaidMcpClient>[1]) {
  const server = createMockServer();
  const client = new PaidMcpClient(
    { name: 'test-client', version: '1.0.0' },
    config,
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client, clientTransport, serverTransport };
}

describe('PaidMcpClient', () => {
  let server: McpServer;
  let client: PaidMcpClient;

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
    }
    if (server) {
      await server.close().catch(() => {});
    }
  });

  it('passes through free tools unchanged', async () => {
    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
    }));

    const result = await client.callTool({ name: 'free-tool', arguments: { input: 'hello' } });
    const r = result as { content: Array<{ type: string; text: string }> };
    expect(r.content[0].text).toBe('free-result');
  });

  it('auto-pays for paid tools transparently', async () => {
    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
    }));

    const result = await client.callTool({ name: 'paid-tool', arguments: { query: 'test' } });
    const r = result as { content: Array<{ type: string; text: string }> };
    expect(r.content[0].text).toBe('paid-result');
  });

  it('tracks spending after payment', async () => {
    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
    }));

    const statsBefore = client.getSpendingStats();
    expect(statsBefore.totalCents).toBe(0);
    expect(statsBefore.callCount).toBe(0);

    await client.callTool({ name: 'paid-tool', arguments: { query: 'test' } });

    const statsAfter = client.getSpendingStats();
    expect(statsAfter.totalCents).toBe(500);
    expect(statsAfter.todayCents).toBe(500);
    expect(statsAfter.callCount).toBe(1);
  });

  it('throws BudgetExceededError when over per-call limit', async () => {
    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
      budget: { maxPerCallCents: 5000 },
    }));

    await expect(
      client.callTool({ name: 'expensive-tool', arguments: {} }),
    ).rejects.toThrow(BudgetExceededError);

    try {
      await client.callTool({ name: 'expensive-tool', arguments: {} });
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetExceededError);
      const err = e as BudgetExceededError;
      expect(err.limitType).toBe('per-call');
      expect(err.limitCents).toBe(5000);
      expect(err.requestedCents).toBe(10000);
    }
  });

  it('calls onPaymentRequired callback and proceeds when approved', async () => {
    const callback = vi.fn().mockResolvedValue(true);

    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
      onPaymentRequired: callback,
    }));

    const result = await client.callTool({ name: 'paid-tool', arguments: { query: 'test' } });
    const r = result as { content: Array<{ type: string; text: string }> };
    expect(r.content[0].text).toBe('paid-result');

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({
      toolName: 'paid-tool',
      amountCents: 500,
      currency: 'USD',
      protocol: 'x402',
    });
  });

  it('throws PaymentRejectedError when callback returns false', async () => {
    const callback = vi.fn().mockResolvedValue(false);

    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
      onPaymentRequired: callback,
    }));

    await expect(
      client.callTool({ name: 'paid-tool', arguments: { query: 'test' } }),
    ).rejects.toThrow(PaymentRejectedError);

    try {
      await client.callTool({ name: 'paid-tool', arguments: { query: 'test' } });
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentRejectedError);
      const err = e as PaymentRejectedError;
      expect(err.toolName).toBe('paid-tool');
    }
  });

  it('does not track spending for free tools', async () => {
    ({ server, client } = await setupPair({
      walletPrivateKey: 'test-key',
    }));

    await client.callTool({ name: 'free-tool', arguments: { input: 'hello' } });
    await client.callTool({ name: 'free-tool', arguments: { input: 'world' } });

    const stats = client.getSpendingStats();
    expect(stats.totalCents).toBe(0);
    expect(stats.callCount).toBe(0);
  });

  it('throws when no signer configured for protocol', async () => {
    // No walletPrivateKey — no x402 signer
    ({ server, client } = await setupPair({
      stripePaymentMethodId: 'pm_test',
    }));

    await expect(
      client.callTool({ name: 'paid-tool', arguments: { query: 'test' } }),
    ).rejects.toThrow('No signer configured for protocol: x402');
  });
});
