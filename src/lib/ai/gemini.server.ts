import { AppError } from "@/lib/errors";
import type { AIProvider, GenerateRequest, GenerateResult } from "./provider";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.7-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Gemini implementation. The API key only ever exists server-side.
 */
export class GeminiProvider implements AIProvider {
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GATEWAY_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: request.prompt }],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("AI_TIMEOUT", "AI request aborted after timeout");
      }
      throw new AppError("AI_PROVIDER_ERROR", `AI request failed: ${String(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new AppError("RATE_LIMITED", `Provider rate limited: ${detail.slice(0, 300)}`);
      }
      if (response.status === 402 || response.status === 403) {
        throw new AppError(
          "AI_PROVIDER_ERROR",
          `Provider blocked request (${response.status}): ${detail.slice(0, 300)}`,
          "AI generation is temporarily unavailable. Please contact the app owner.",
        );
      }
      throw new AppError(
        "AI_PROVIDER_ERROR",
        `Provider error ${response.status}: ${detail.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text || text.trim() === "") {
      throw new AppError("INVALID_AI_RESPONSE", "Provider returned empty content");
    }

    return {
      text,
      model: this.model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
      },
    };
  }
}

export function createProvider(): AIProvider {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new AppError("INTERNAL_ERROR", "LOVABLE_API_KEY is not configured");
  }
  return new GeminiProvider(apiKey);
}

/** Tolerant JSON extraction: models sometimes wrap JSON in fences. */
export function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AppError("INVALID_AI_RESPONSE", "Model returned invalid JSON");
  }
}
