import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Mock the AI provider — automated tests never call the live model. */
const generate = vi.fn();

vi.mock("@/lib/ai/gemini.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gemini.server")>();
  return {
    ...actual,
    createProvider: () => ({ model: "google/gemini-3.7-flash", generate }),
  };
});

const { runGeneration } = await import("@/lib/generation.server");

const PRODUCT = { id: "p1", slug: "linkedin_post", name: "LinkedIn Post", active: true };
const VERSION = {
  id: "v1",
  version: "1.0",
  prompt: "PRODUCT: LinkedIn Post",
  input_schema: { fields: [{ name: "topic", label: "Topic", type: "textarea", required: true }] },
  output_schema: { fields: ["content"] },
};

const inserted: Array<Record<string, unknown>> = [];

/** Minimal fake of the Supabase query builder used by the pipeline. */
function fakeSupabase(options: { product?: unknown; version?: unknown; generationCount?: number } = {}) {
  const product = "product" in options ? options.product : PRODUCT;
  const version = "version" in options ? options.version : VERSION;

  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "products") return { data: product, error: null };
          if (table === "product_versions") return { data: version, error: null };
          return { data: null, error: null };
        },
        single: async () => ({ data: { id: "gen-1", created_at: "2026-01-01T00:00:00Z" }, error: null }),
        insert: (row: Record<string, unknown>) => {
          inserted.push({ table, ...row });
          return chain;
        },
        then: undefined,
      };
      if (table === "generations") {
        chain.select = (_cols: string, opts?: { count?: string; head?: boolean }) =>
          opts?.head
            ? { eq: () => ({ gte: async () => ({ count: options.generationCount ?? 0, error: null }) }) }
            : chain;
      }
      return chain;
    },
  } as any;
}

const args = (supabase: any) => ({
  supabase,
  userId: "user-1",
  productSlug: "linkedin_post",
  rawInputs: { topic: "why fundamentals matter" },
});

beforeEach(() => {
  generate.mockReset();
  inserted.length = 0;
});

describe("runGeneration", () => {
  it("generates, validates and saves a successful generation", async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({ content: "A useful post." }),
      model: "google/gemini-3.7-flash",
    });

    const result = await runGeneration(args(fakeSupabase()));

    expect(result.generationId).toBe("gen-1");
    expect(result.output).toEqual({ content: "A useful post." });
    expect(inserted[0]).toMatchObject({ table: "generations", status: "success", user_id: "user-1" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0].prompt).toContain("why fundamentals matter");
  });

  it("rejects missing required input before calling the model", async () => {
    await expect(
      runGeneration({ ...args(fakeSupabase()), rawInputs: {} }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails with PRODUCT_NOT_FOUND for an inactive/unknown product", async () => {
    await expect(runGeneration(args(fakeSupabase({ product: null })))).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    generate
      .mockResolvedValueOnce({ text: "not json at all", model: "m" })
      .mockResolvedValueOnce({ text: JSON.stringify({ content: "ok" }), model: "m" });

    const result = await runGeneration(args(fakeSupabase()));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.output["content"]).toBe("ok");
  });

  it("records a failed generation when output never validates", async () => {
    generate.mockResolvedValue({ text: JSON.stringify({ wrong: "shape" }), model: "m" });

    await expect(runGeneration(args(fakeSupabase()))).rejects.toMatchObject({
      code: "OUTPUT_VALIDATION_ERROR",
    });
    expect(inserted[0]).toMatchObject({ status: "failed", error_code: "OUTPUT_VALIDATION_ERROR" });
  });

  it("surfaces provider timeouts safely", async () => {
    generate.mockRejectedValue(new AppError("AI_TIMEOUT", "aborted"));

    await expect(runGeneration(args(fakeSupabase()))).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("blocks requests over the rate limit", async () => {
    await expect(
      runGeneration(args(fakeSupabase({ generationCount: 999 }))),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(generate).not.toHaveBeenCalled();
  });
});
