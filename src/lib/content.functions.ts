import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "@/lib/errors";
import type { InputSchema } from "@/lib/products/schema";

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
}

export interface ProductDetail extends ProductSummary {
  version: string;
  inputSchema: InputSchema;
  outputFields: string[];
}

export interface HistoryItem {
  id: string;
  productSlug: string;
  productName: string;
  status: string;
  preview: string;
  createdAt: string;
  output: Record<string, string> | null;
  inputs: Record<string, string>;
}

export interface ProfileData {
  name: string;
  profession: string;
  industry: string;
  company: string;
  expertise: string;
  preferred_tone: string;
  writing_style: string;
}

/** Converts any thrown error into a safe client error. */
function fail(error: unknown): never {
  if (error instanceof AppError) {
    console.error(`[${error.code}] ${error.message}`);
    throw new Error(error.userMessage);
  }
  console.error(error);
  throw new Error("Something went wrong. Please try again.");
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProductSummary[]> => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, slug, name, description, category")
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) fail(new AppError("INTERNAL_ERROR", error.message));
    return (data ?? []) as ProductSummary[];
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => {
    if (!input?.slug) throw new Error("Missing product");
    return input;
  })
  .handler(async ({ data, context }): Promise<ProductDetail> => {
    const { data: product, error } = await context.supabase
      .from("products")
      .select("id, slug, name, description, category")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) fail(new AppError("INTERNAL_ERROR", error.message));
    if (!product) fail(new AppError("PRODUCT_NOT_FOUND", `Unknown slug ${data.slug}`));

    const { data: version, error: versionError } = await context.supabase
      .from("product_versions")
      .select("version, input_schema, output_schema")
      .eq("product_id", product!.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) fail(new AppError("INTERNAL_ERROR", versionError.message));
    if (!version) fail(new AppError("PRODUCT_NOT_FOUND", `No active version for ${data.slug}`));

    return {
      ...(product as ProductSummary),
      version: version!.version as string,
      inputSchema: version!.input_schema as unknown as InputSchema,
      outputFields: ((version!.output_schema as unknown as { fields?: string[] })?.fields ?? []) as string[],
    };
  });

export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; inputs: Record<string, string> }) => {
    if (!input?.slug) throw new Error("Missing product");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { runGeneration } = await import("@/lib/generation.server");
    try {
      return await runGeneration({
        supabase: context.supabase,
        userId: context.userId,
        productSlug: data.slug,
        rawInputs: data.inputs ?? {},
      });
    } catch (error) {
      fail(error);
    }
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HistoryItem[]> => {
    const { data, error } = await context.supabase
      .from("generations")
      .select("id, status, created_at, input_data, output_data, products(slug, name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) fail(new AppError("INTERNAL_ERROR", error.message));

    return (data ?? []).map((row: any) => {
      const output = (row.output_data ?? null) as Record<string, string> | null;
      const body = output?.["content"] ?? output?.["subject"] ?? "";
      return {
        id: row.id as string,
        productSlug: row.products?.slug ?? "",
        productName: row.products?.name ?? "Unknown product",
        status: row.status as string,
        preview: body.slice(0, 140),
        createdAt: row.created_at as string,
        output,
        inputs: (row.input_data ?? {}) as Record<string, string>,
      };
    });
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileData> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("name, profession, industry, company, expertise, preferred_tone, writing_style")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) fail(new AppError("INTERNAL_ERROR", error.message));
    const row = (data ?? {}) as Partial<ProfileData>;
    return {
      name: row.name ?? "",
      profession: row.profession ?? "",
      industry: row.industry ?? "",
      company: row.company ?? "",
      expertise: row.expertise ?? "",
      preferred_tone: row.preferred_tone ?? "",
      writing_style: row.writing_style ?? "",
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<ProfileData>) => input ?? {})
  .handler(async ({ data, context }) => {
    const clean = (value: unknown) =>
      typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 1000) : null;

    const { error } = await context.supabase.from("profiles").upsert(
      {
        user_id: context.userId,
        name: clean(data.name),
        profession: clean(data.profession),
        industry: clean(data.industry),
        company: clean(data.company),
        expertise: clean(data.expertise),
        preferred_tone: clean(data.preferred_tone),
        writing_style: clean(data.writing_style),
      },
      { onConflict: "user_id" },
    );
    if (error) fail(new AppError("INTERNAL_ERROR", error.message));
    return { ok: true };
  });
