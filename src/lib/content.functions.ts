import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "@/lib/errors";
import type { InputSchema } from "@/lib/products/schema";
import { createRazorpaySubscription } from "@/lib/razorpay.server";

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

type GenerationHistoryRow = {
  id: string;
  status: string;
  created_at: string;
  input_data: unknown;
  output_data: unknown;
  products: {
    slug: string;
    name: string;
  } | null;
};

export interface PlanData {
  id: string;
  slug: string;
  name: string;
  monthly_generations: number;
  price_monthly: number;
  currency: string;
  active: boolean;
}

export interface SubscriptionData {
  id: string;
  status: string;
  provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  plan: PlanData;
}

export interface UsageData {
  period_start: string;
  generation_count: number;
  monthly_limit: number;
  remaining: number;
}

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  monthly_generations: number;
  price_monthly: number;
  currency: string;
  active: boolean;
};

type SubscriptionPlanRow = {
  id: string;
  slug: string;
  name: string;
  monthly_generations: number;
  price_monthly: number;
  currency: string;
  active: boolean;
};

function toPlanData(row: PlanRow | SubscriptionPlanRow): PlanData {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    monthly_generations: row.monthly_generations,
    price_monthly: row.price_monthly,
    currency: row.currency,
    active: row.active,
  };
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

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
    }));
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => {
    if (!input?.slug) {
      throw new Error("Missing product");
    }

    return input;
  })
  .handler(async ({ data, context }): Promise<ProductDetail> => {
    const { data: product, error } = await context.supabase
      .from("products")
      .select("id, slug, name, description, category")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    if (!product) {
      fail(new AppError("PRODUCT_NOT_FOUND", `Unknown slug ${data.slug}`));
    }

    const { data: version, error: versionError } = await context.supabase
      .from("product_versions")
      .select("version, input_schema, output_schema")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      fail(new AppError("INTERNAL_ERROR", versionError.message));
    }

    if (!version) {
      fail(new AppError("PRODUCT_NOT_FOUND", `No active version for ${data.slug}`));
    }

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      version: version.version,
      inputSchema: version.input_schema as unknown as InputSchema,
      outputFields:
        (
          version.output_schema as unknown as {
            fields?: string[];
          }
        )?.fields ?? [],
    };
  });

export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; inputs: Record<string, string> }) => {
    if (!input?.slug) {
      throw new Error("Missing product");
    }

    if (!input?.inputs || typeof input.inputs !== "object") {
      throw new Error("Missing inputs");
    }

    return input;
  })
  .handler(async ({ data, context }) => {
    let creditConsumed = false;

    try {
      const { data: product, error: productError } = await context.supabase
        .from("products")
        .select("id, slug")
        .eq("slug", data.slug)
        .eq("active", true)
        .maybeSingle();

      if (productError) {
        fail(new AppError("INTERNAL_ERROR", productError.message));
      }

      if (!product) {
        fail(new AppError("PRODUCT_NOT_FOUND", `Unknown slug ${data.slug}`));
      }

      const { data: creditResult, error: creditError } = await context.supabase.rpc(
        "consume_generation_credit",
        {
          p_user_id: context.userId,
        },
      );

      if (creditError) {
        console.error("[USAGE_ERROR]", creditError.message);

        fail(new AppError("INTERNAL_ERROR", `Unable to check usage: ${creditError.message}`));
      }

      const credit = Array.isArray(creditResult) ? creditResult[0] : creditResult;

      if (!credit?.allowed) {
        throw new AppError(
          "RATE_LIMITED",
          "Monthly generation limit reached",
          "You have reached your monthly generation limit. Please upgrade your plan to continue.",
        );
      }

      creditConsumed = true;

      const { runGeneration } = await import("@/lib/generation.server");

      return await runGeneration({
        supabase: context.supabase,
        userId: context.userId,
        productSlug: data.slug,
        rawInputs: data.inputs,
      });
    } catch (error) {
      if (creditConsumed) {
        try {
          const { error: refundError } = await context.supabase.rpc("refund_generation_credit", {
            p_user_id: context.userId,
          });

          if (refundError) {
            console.error("[USAGE_REFUND_ERROR]", refundError.message);
          }
        } catch (refundError) {
          console.error("[USAGE_REFUND_ERROR]", refundError);
        }
      }

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
      .limit(30);

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    return (data ?? []).map((row: GenerationHistoryRow) => {
      const output = (row.output_data ?? null) as Record<string, string> | null;

      const body = output?.["content"] ?? output?.["subject"] ?? "";

      return {
        id: row.id,
        productSlug: row.products?.slug ?? "",
        productName: row.products?.name ?? "Unknown product",
        status: row.status,
        preview: body.slice(0, 140),
        createdAt: row.created_at,
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

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

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

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    return { ok: true };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanData[]> => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("id, slug, name, monthly_generations, price_monthly, currency, active")
      .eq("active", true)
      .order("monthly_generations", { ascending: true });

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    return (data ?? []).map((row) => toPlanData(row));
  });

export const getSubscription = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionData> => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select(
        `
          id,
          status,
          provider,
          current_period_start,
          current_period_end,
          plans (
            id,
            slug,
            name,
            monthly_generations,
            price_monthly,
            currency,
            active
          )
        `,
      )
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      fail(new AppError("INTERNAL_ERROR", error.message));
    }

    if (data?.plans) {
      return {
        id: data.id,
        status: data.status,
        provider: data.provider,
        current_period_start: data.current_period_start,
        current_period_end: data.current_period_end,
        plan: toPlanData(data.plans),
      };
    }

    const { data: freePlan, error: freePlanError } = await context.supabase
      .from("plans")
      .select("id, slug, name, monthly_generations, price_monthly, currency, active")
      .eq("slug", "free")
      .eq("active", true)
      .maybeSingle();

    if (freePlanError || !freePlan) {
      fail(new AppError("INTERNAL_ERROR", freePlanError?.message ?? "Free plan is not configured"));
    }

    return {
      id: "",
      status: "active",
      provider: null,
      current_period_start: null,
      current_period_end: null,
      plan: toPlanData(freePlan),
    };
  });

export const createSubscription = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => {
    if (!input?.planId || typeof input.planId !== "string") {
      throw new Error("Missing plan");
    }

    return input;
  })
  .handler(async ({ data, context }) => {
    try {
      // The client sends only the Supabase plan ID.
      // Price and Razorpay plan ID are always read from the database.
      const { data: plan, error: planError } = await context.supabase
        .from("plans")
        .select("id, slug, name, price_monthly, currency, active, razorpay_plan_id")
        .eq("id", data.planId)
        .eq("active", true)
        .maybeSingle();

      if (planError) {
        fail(new AppError("INTERNAL_ERROR", planError.message));
      }

      if (!plan) {
        fail(new AppError("INVALID_INPUT", "Selected plan is not available."));
      }

      if (plan.slug === "free") {
        fail(new AppError("INVALID_INPUT", "The free plan does not require payment."));
      }

      if (!plan.razorpay_plan_id) {
        fail(
          new AppError(
            "INTERNAL_ERROR",
            `Razorpay plan is not configured for ${plan.slug}.`,
          ),
        );
      }

      // Prevent accidentally creating multiple paid subscriptions.
      const { data: existingSubscription, error: existingError } = await context.supabase
        .from("subscriptions")
        .select("id, status, plan_id")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .maybeSingle();

      if (existingError) {
        fail(new AppError("INTERNAL_ERROR", existingError.message));
      }

      if (existingSubscription) {
        fail(
          new AppError(
            "INVALID_INPUT",
            "You already have an active subscription. Please manage your current plan instead.",
          ),
        );
      }

      const { data: authUser, error: authUserError } = await context.supabase.auth.getUser();

      if (authUserError) {
        fail(new AppError("INTERNAL_ERROR", authUserError.message));
      }

      const razorpaySubscription = await createRazorpaySubscription({
        planId: plan.razorpay_plan_id,
        userId: context.userId,
        userEmail: authUser.user?.email ?? null,
      });

      console.log(
        JSON.stringify({
          scope: "payment",
          event: "razorpay_subscription_created",
          userId: context.userId,
          planId: plan.id,
          planSlug: plan.slug,
          razorpaySubscriptionId: razorpaySubscription.id,
        }),
      );

      return {
        subscriptionId: razorpaySubscription.id,
        razorpayKeyId: process.env["RAZORPAY_KEY_ID"],
        planId: plan.id,
        planSlug: plan.slug,
        planName: plan.name,
        amount: plan.price_monthly,
        currency: plan.currency,
      };
    } catch (error) {
      fail(error);
    }
  });

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageData> => {
    const now = new Date();

    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

    const { data: usage, error: usageError } = await context.supabase
      .from("usage")
      .select("period_start, generation_count")
      .eq("user_id", context.userId)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (usageError) {
      fail(new AppError("INTERNAL_ERROR", usageError.message));
    }

    const { data: subscription, error: subscriptionError } = await context.supabase
      .from("subscriptions")
      .select(
        `
            plans (
              monthly_generations
            )
          `,
      )
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    if (subscriptionError) {
      fail(new AppError("INTERNAL_ERROR", subscriptionError.message));
    }

    let monthlyLimit = subscription?.plans?.monthly_generations;

    if (monthlyLimit == null) {
      const { data: freePlan, error: freePlanError } = await context.supabase
        .from("plans")
        .select("monthly_generations")
        .eq("slug", "free")
        .eq("active", true)
        .maybeSingle();

      if (freePlanError || !freePlan) {
        fail(
          new AppError("INTERNAL_ERROR", freePlanError?.message ?? "Free plan is not configured"),
        );
      }

      monthlyLimit = freePlan.monthly_generations;
    }

    const generationCount = usage?.generation_count ?? 0;

    return {
      period_start: periodStart,
      generation_count: generationCount,
      monthly_limit: monthlyLimit,
      remaining: Math.max(monthlyLimit - generationCount, 0),
    };
  });
