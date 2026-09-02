import { AppError } from "@/lib/errors";
import type { AIProvider, GenerateRequest, GenerateResult } from "./provider";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

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

    const url =
      `${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}` +
      `:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: request.prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
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

    const rawText = await response.text();

    let payload: GeminiResponse;

    try {
      payload = JSON.parse(rawText) as GeminiResponse;
    } catch {
      throw new AppError(
        "AI_PROVIDER_ERROR",
        `Gemini returned non-JSON response: ${rawText.slice(0, 300)}`,
      );
    }

    if (!response.ok) {
      const detail = payload.error?.message ?? rawText.slice(0, 300);

      if (response.status === 429) {
        throw new AppError("RATE_LIMITED", `Gemini rate limited request: ${detail}`);
      }

      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          "AI_PROVIDER_ERROR",
          `Gemini authentication failed (${response.status}): ${detail}`,
          "AI generation is temporarily unavailable. Please contact the app owner.",
        );
      }

      throw new AppError("AI_PROVIDER_ERROR", `Gemini error ${response.status}: ${detail}`);
    }

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      const finishReason = payload.candidates?.[0]?.finishReason;

      throw new AppError(
        "INVALID_AI_RESPONSE",
        `Gemini returned empty content${finishReason ? ` (finish reason: ${finishReason})` : ""}`,
      );
    }

    return {
      text,
      model: this.model,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount,
        completionTokens: payload.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}

export function createProvider(): AIProvider {
  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey) {
    throw new AppError("INTERNAL_ERROR", "GEMINI_API_KEY is not configured");
  }

  const model = process.env["GEMINI_MODEL"] || DEFAULT_MODEL;

  return new GeminiProvider(apiKey, model);
}

export function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
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
        // Fall through.
      }
    }

    throw new AppError("INVALID_AI_RESPONSE", "Model returned invalid JSON");
  }
}
