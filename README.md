# agentic-mcp-pay-client

Client SDK for paid MCP tools — auto-pay, budget controls, multi-protocol.

Drop-in wrapper for the MCP SDK `Client` that transparently handles `PAYMENT_REQUIRED` challenges. Your agent calls tools as usual; the client negotiates payment behind the scenes.

## Install

```bash
npm install agentic-mcp-pay-client
```

## Quick Start

```typescript
import { PaidMcpClient } from "agentic-mcp-pay-client";

const client = new PaidMcpClient(
  { name: "my-agent", version: "1.0.0" },
  {
    walletPrivateKey: process.env.WALLET_KEY,
    budget: {
      maxPerCallCents: 1000,  // $10 max per tool call
      maxDailyCents: 10000,   // $100 daily cap
    },
  }
);

await client.connect(transport);

// Tools that require payment are handled automatically
const result = await client.callTool({
  name: "premium-search",
  arguments: { query: "market analysis" },
});
```

## Budget Controls

Set spending limits to prevent runaway costs:

```typescript
const client = new PaidMcpClient(
  { name: "my-agent", version: "1.0.0" },
  {
    walletPrivateKey: process.env.WALLET_KEY,
    budget: {
      maxPerCallCents: 500,   // reject any single call over $5
      maxDailyCents: 5000,    // stop after $50/day
    },
  }
);
```

Throws `BudgetExceededError` when a tool's price exceeds either limit.

## Approval Callback

Require human approval before paying:

```typescript
const client = new PaidMcpClient(
  { name: "my-agent", version: "1.0.0" },
  {
    walletPrivateKey: process.env.WALLET_KEY,
    onPaymentRequired: async (info) => {
      console.log(`Tool "${info.toolName}" costs ${info.amountCents}c (${info.protocol})`);
      return confirm("Approve?"); // return false to reject
    },
  }
);
```

Throws `PaymentRejectedError` when the callback returns `false`.

## Spending Stats

```typescript
const stats = client.getSpendingStats();
// { totalCents: 1500, todayCents: 500, callCount: 3 }
```

## Supported Protocols

| Protocol | Credential Config Key       | Description                  |
| -------- | --------------------------- | ---------------------------- |
| `x402`   | `walletPrivateKey`          | HMAC-SHA256 signed challenges |
| `stripe` | `stripePaymentMethodId`     | Stripe payment method pass-through |
| `mpp`    | `mppSessionToken`           | Micropayment protocol session token |

## How It Works

1. Your agent calls `client.callTool()` as normal.
2. If the server returns `PAYMENT_REQUIRED`, the client parses the challenge.
3. Budget limits are checked. The `onPaymentRequired` callback is called (if set).
4. The appropriate signer produces a proof for the challenge's protocol.
5. The tool call is retried with `_payment: { nonce, proof, protocol }` in arguments.
6. The spend is recorded in the budget tracker.
7. The successful result is returned to your agent — transparently.

## Gateway

This client is designed to work with [agentic-mcp-pay](https://github.com/yeqy1/agentic-mcp-pay), the server-side payment gateway for MCP tools.

## License

MIT
