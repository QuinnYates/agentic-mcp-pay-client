import { PaymentChallenge } from './types.js';

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}

function extractFirstText(result: ToolResult): string | null {
  const content = result.content;
  if (!content || content.length === 0) return null;
  const first = content[0];
  if (first.type !== 'text' || typeof first.text !== 'string') return null;
  return first.text;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the tool result is a PAYMENT_REQUIRED error response.
 */
export function isPaymentRequired(result: unknown): boolean {
  const r = result as ToolResult;
  if (!r.isError) return false;

  const text = extractFirstText(r);
  if (text === null) return false;

  const parsed = tryParseJson(text);
  if (parsed === null) return false;

  return parsed.code === 'PAYMENT_REQUIRED';
}

/**
 * Extracts the PaymentChallenge from a PAYMENT_REQUIRED tool result.
 * Returns null if the result is not a payment required response.
 */
export function parsePaymentRequired(result: unknown): PaymentChallenge | null {
  const r = result as ToolResult;
  if (!r.isError) return null;

  const text = extractFirstText(r);
  if (text === null) return null;

  const parsed = tryParseJson(text);
  if (parsed === null) return null;

  if (parsed.code !== 'PAYMENT_REQUIRED') return null;

  const data = parsed.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return null;

  // Extract required fields
  const version = data.version as string;
  const protocol = data.protocol as string;
  const amount = data.amount as number;
  const currency = data.currency as string;
  const nonce = data.nonce as string;
  const payTo = data.payTo as string;

  if (!version || !protocol || amount === undefined || !currency || !nonce || !payTo) {
    return null;
  }

  const challenge: PaymentChallenge = {
    version,
    protocol,
    amount,
    currency,
    nonce,
    payTo,
  };

  if (data.network !== undefined) challenge.network = data.network as string;
  if (data.token !== undefined) challenge.token = data.token as string;
  if (data.expiresAt !== undefined) challenge.expiresAt = data.expiresAt as string;

  return challenge;
}
