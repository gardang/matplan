// Utility: parse Anthropic SDK errors into structured, user-facing responses
// Used by all API routes that call Claude.

import Anthropic from "@anthropic-ai/sdk";

export type AnthropicErrorCode = "billing" | "auth" | "rate_limit" | "overloaded" | "unknown";

export interface ParsedAnthropicError {
  code: AnthropicErrorCode;
  /** Norwegian user-facing message */
  message: string;
  /** Only present for billing errors */
  billingUrl?: string;
}

export const BILLING_URL = "https://platform.claude.com/settings/billing";

export function parseAnthropicError(err: unknown): ParsedAnthropicError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    // The SDK puts the parsed body in .error; the actual error detail is nested
    const body = err.error as
      | { type?: string; error?: { type?: string; message?: string } }
      | undefined;
    const innerType = body?.error?.type ?? "";
    const innerMessage = (body?.error?.message ?? "").toLowerCase();

    // ── Credits / billing ──────────────────────────────────────────────────
    // Anthropic returns 400 with message containing "credit balance" or "billing",
    // or 402 Payment Required, when the account has no credits.
    if (
      status === 402 ||
      innerType === "billing_error" ||
      innerMessage.includes("credit") ||
      innerMessage.includes("billing") ||
      innerMessage.includes("balance")
    ) {
      return {
        code: "billing",
        message:
          "API-kreditter er oppbrukt. Fyll på for å fortsette å bruke AI-funksjoner.",
        billingUrl: BILLING_URL,
      };
    }

    // ── Authentication ─────────────────────────────────────────────────────
    if (status === 401 || innerType === "authentication_error") {
      return {
        code: "auth",
        message: "Ugyldig API-nøkkel. Sjekk miljøvariabelen ANTHROPIC_API_KEY.",
      };
    }

    // ── Rate limit ─────────────────────────────────────────────────────────
    if (status === 429 || innerType === "rate_limit_error") {
      return {
        code: "rate_limit",
        message: "For mange forespørsler. Vent litt og prøv igjen.",
      };
    }

    // ── Overloaded ─────────────────────────────────────────────────────────
    if (status === 529 || innerType === "overloaded_error") {
      return {
        code: "overloaded",
        message: "Claude er overbelastet akkurat nå. Prøv igjen om litt.",
      };
    }
  }

  return {
    code: "unknown",
    message: "Noe gikk galt med AI-kallet. Prøv igjen.",
  };
}

/** Returns a NextResponse-compatible JSON body for API routes */
export function anthropicErrorResponse(err: unknown): {
  body: { error: string; code: AnthropicErrorCode; billingUrl?: string };
  status: number;
} {
  const parsed = parseAnthropicError(err);
  return {
    body: {
      error: parsed.message,
      code: parsed.code,
      ...(parsed.billingUrl ? { billingUrl: parsed.billingUrl } : {}),
    },
    status: parsed.code === "billing" ? 402 : 500,
  };
}
