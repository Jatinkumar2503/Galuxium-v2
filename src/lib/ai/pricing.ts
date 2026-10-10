/**
 * AI Model Pricing Table & Metered Cost Calculator (Phase 6.8)
 *
 * NOTE: Prices as of October 10, 2026.
 * Standard rates per Million Tokens (MTok) in USD:
 * - Claude 3.5 Sonnet / Claude Sonnet 5.5: $3.00 / MTok input, $15.00 / MTok output
 * - Claude 3.5 Haiku / Claude Haiku 4.5: $0.80 / MTok input, $4.00 / MTok output
 */

export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export const MODEL_PRICING_REGISTRY: Record<string, ModelPricing> = {
  // Flagship extraction models
  'claude-sonnet-5-5': {
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
  },
  'claude-3-5-sonnet-20241022': {
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
  },
  'claude-3-7-sonnet-20250219': {
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
  },

  // High-speed cost-effective models
  'claude-haiku-4-5-20251001': {
    inputPerMillionUsd: 0.8,
    outputPerMillionUsd: 4.0,
  },
  'claude-3-5-haiku-20241022': {
    inputPerMillionUsd: 0.8,
    outputPerMillionUsd: 4.0,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillionUsd: 3.0,
  outputPerMillionUsd: 15.0,
};

/**
 * Calculates extraction cost in integer USD micro-dollars (1 USD = 1,000,000 micros).
 * Ensures monetary precision without floating-point inaccuracies.
 */
export function calculateExtractionCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING_REGISTRY[model] || DEFAULT_PRICING;

  // input_cost = input_tokens * (inputPerMillionUsd / 1,000,000)
  // in micros (multiply by 1,000,000) => input_tokens * inputPerMillionUsd
  const inputMicros = Math.round(inputTokens * pricing.inputPerMillionUsd);
  const outputMicros = Math.round(outputTokens * pricing.outputPerMillionUsd);

  return inputMicros + outputMicros;
}
