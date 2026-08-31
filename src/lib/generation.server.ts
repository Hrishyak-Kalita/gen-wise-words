import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider, parseModelJson } from "@/lib/ai/gemini.server";
import { AppError } from "@/lib/errors";
import { buildPrompt } from "@/lib/prompts/build-prompt";
import {
  parseInputSchema,
  parseOutputSchema,
  validateInputs,
  validateOutput,
} from "@/lib/products/schema";

/** Configurable rate limit: generations allowed per user per window. */
export const RATE_LIMIT = { maxGenerations: 30, windowMinutes: 60 };

type Client = SupabaseClient<any, any, any>;

export type Stage =
  | "auth"
  | "rate_limit"
  | "load_product"
  | "validate_input"
  | "load_profile"
  | "build_prompt"
  | "ai_request"
  | "ai_response"
  | "validate_output"
  | "save";

function log(stage: Stage, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "generation", stage, ...data }));
}

export interface GenerationResult {
  generationId: string;
  productSlug: string;
  output: Record<string, string>;
  inputs: Record<string, string>;
  createdAt: string;
}

/**
 * The one shared generation pipeline. Every product flows through it:
 * product -> input schema -> prompt -> output schema -> engine.
 */
export async function runGeneration(params: {
  supabase: Client;
  userId: string;
  productSlug: string;
  rawInputs: unknown;
}): Promise<GenerationResult> {
  const { supabase, userId, productSlug } = params;
  const startedAt = Date.now();

  // Rate limit
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
  const { count, error: countError } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (countError) {
    log("rate_limit", { userId, error: countError.message });
  } else if ((count ?? 0) >= RATE_LIMIT.maxGenerations) {
    log("rate_limit", { userId, count, blocked: true });
    throw new AppError("RATE_LIMITED", `User ${userId} exceeded ${RATE_LIMIT.maxGenerations}/${RATE_LIMIT.windowMinutes}min`);
  }

  // Load product + active version
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, slug, name, active")
    .eq("slug", productSlug)
    .eq("active", true)
    .maybeSingle();
  if (productError) throw new AppError("INTERNAL_ERROR", `Product load failed: ${productError.message}`);
  if (!product) {
    log("load_product", { productSlug, found: false });
    throw new AppError("PRODUCT_NOT_FOUND", `No active product for slug ${productSlug}`);
  }

  const { data: version, error: versionError } = await supabase
    .from("product_versions")
    .select("id, version, prompt, input_schema, output_schema")
    .eq("product_id", product.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new AppError("INTERNAL_ERROR", `Version load failed: ${versionError.message}`);
  if (!version) throw new AppError("PRODUCT_NOT_FOUND", `No active version for ${productSlug}`);

  const inputSchema = parseInputSchema(version.input_schema);
  const outputSchema = parseOutputSchema(version.output_schema);

  // Validate inputs
  const inputs = validateInputs(inputSchema, params.rawInputs);

  // Load profile (optional context)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, profession, industry, company, expertise, preferred_tone, writing_style")
    .eq("user_id", userId)
    .maybeSingle();

  const prompt = buildPrompt({
    productPrompt: version.prompt,
    inputSchema,
    outputSchema,
    inputs,
    profile: profile ?? null,
  });
  log("build_prompt", { userId, productSlug, version: version.version, promptChars: prompt.length });

  const provider = createProvider();

  // AI request with a single retry on invalid structure
  let output: Record<string, string> | null = null;
  let model = provider.model;
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await provider.generate({ prompt, outputFields: outputSchema.fields });
      model = result.model;
      log("ai_response", {
        userId,
        productSlug,
        attempt,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      });
      output = validateOutput(outputSchema, parseModelJson(result.text));
      break;
    } catch (error) {
      const appError =
        error instanceof AppError ? error : new AppError("AI_PROVIDER_ERROR", String(error));
      lastError = appError;
      log("ai_request", { userId, productSlug, attempt, code: appError.code, detail: appError.message });
      const retryable =
        appError.code === "INVALID_AI_RESPONSE" ||
        appError.code === "OUTPUT_VALIDATION_ERROR" ||
        appError.code === "AI_PROVIDER_ERROR";
      if (!retryable || attempt === 2) break;
    }
  }

  const latency = Date.now() - startedAt;

  if (!output) {
    const failure = lastError ?? new AppError("INTERNAL_ERROR", "Unknown generation failure");
    await supabase.from("generations").insert({
      user_id: userId,
      product_id: product.id,
      product_version_id: version.id,
      input_data: inputs,
      output_data: null,
      status: "failed",
      error_code: failure.code,
      model,
      latency_ms: latency,
    });
    log("save", { userId, productSlug, status: "failed", code: failure.code, latency });
    throw failure;
  }

  const { data: saved, error: saveError } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      product_id: product.id,
      product_version_id: version.id,
      input_data: inputs,
      output_data: output,
      status: "success",
      model,
      latency_ms: latency,
    })
    .select("id, created_at")
    .single();
  if (saveError || !saved) {
    log("save", { userId, productSlug, error: saveError?.message });
    throw new AppError("INTERNAL_ERROR", `Failed to save generation: ${saveError?.message}`);
  }

  log("save", {
    generationId: saved.id,
    userId,
    productId: product.id,
    productVersion: version.version,
    model,
    status: "success",
    latency,
  });

  return {
    generationId: saved.id,
    productSlug,
    output,
    inputs,
    createdAt: saved.created_at,
  };
}
