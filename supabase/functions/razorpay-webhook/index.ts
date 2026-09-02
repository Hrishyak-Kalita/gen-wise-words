import { createClient } from "npm:@supabase/supabase-js@2";
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!RAZORPAY_WEBHOOK_SECRET) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured");
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
);

const corsHeaders = {
    "Content-Type": "application/json",
};

type RazorpaySubscription = {
    id: string;
    plan_id: string;
    customer_id?: string | null;
    status: string;
    current_start?: number | null;
    current_end?: number | null;
    notes?: Record<string, unknown> | unknown[] | null;
};

type RazorpayPayment = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at?: number;
};

type RazorpayWebhookPayload = {
    entity: string;
    event: string;
    payload?: {
        subscription?: {
            entity?: RazorpaySubscription;
        };
        payment?: {
            entity?: RazorpayPayment;
        };
    };
};

async function verifySignature(
    rawBody: string,
    receivedSignature: string,
): Promise<boolean> {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_WEBHOOK_SECRET),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"],
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(rawBody),
    );

    const expected = Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

    if (expected.length !== receivedSignature.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < expected.length; index++) {
        difference |=
            expected.charCodeAt(index) ^
            receivedSignature.charCodeAt(index);
    }

    return difference === 0;
}

function unixToIso(value?: number | null): string | null {
    if (!value) {
        return null;
    }

    return new Date(value * 1000).toISOString();
}

function extractUserId(
    subscription: RazorpaySubscription,
): string | null {
    const notes = subscription.notes;

    if (!notes || Array.isArray(notes)) {
        return null;
    }

    const userId = notes["user_id"];

    return typeof userId === "string" ? userId : null;
}

async function resolvePlan(
    razorpayPlanId: string,
) {
    const { data, error } = await supabase
        .from("plans")
        .select(
            "id, slug, monthly_generations, price_monthly, currency",
        )
        .eq("razorpay_plan_id", razorpayPlanId)
        .eq("active", true)
        .maybeSingle();

    if (error) {
        throw new Error(`Plan lookup failed: ${error.message}`);
    }

    if (!data) {
        throw new Error(
            `No active plan for Razorpay plan ${razorpayPlanId}`,
        );
    }

    return data;
}

function mapSubscriptionStatus(status: string): string {
    switch (status) {
        case "active":
            return "active";

        case "authenticated":
            return "pending";

        case "pending":
            return "pending";

        case "halted":
            return "halted";

        case "cancelled":
            return "cancelled";

        case "completed":
            return "completed";

        case "expired":
            return "expired";

        default:
            return "pending";
    }
}

function shouldUpdateStatus(
    currentStatus: string | null,
    nextStatus: string,
): boolean {
    if (!currentStatus) {
        return true;
    }

    // Never allow an older/lower-priority webhook
    // to downgrade an already active subscription.
    if (
        currentStatus === "active" &&
        (nextStatus === "pending" || nextStatus === "halted")
    ) {
        return false;
    }

    // Terminal states should not be moved back to pending.
    if (
        ["cancelled", "completed", "expired"].includes(currentStatus) &&
        nextStatus === "pending"
    ) {
        return false;
    }

    return true;
}

async function upsertSubscription(
    subscription: RazorpaySubscription,
    planId: string,
    userId: string,
) {
    const nextStatus = mapSubscriptionStatus(
        subscription.status,
    );

    const { data: existing, error: existingError } =
        await supabase
            .from("subscriptions")
            .select("id, status")
            .eq("provider", "razorpay")
            .eq(
                "provider_subscription_id",
                subscription.id,
            )
            .maybeSingle();

    if (existingError) {
        throw new Error(
            `Subscription lookup failed: ${existingError.message}`,
        );
    }

    const status = shouldUpdateStatus(
        existing?.status ?? null,
        nextStatus,
    )
        ? nextStatus
        : existing!.status;

    const values = {
        user_id: userId,
        plan_id: planId,
        status,
        provider: "razorpay",
        provider_customer_id:
            subscription.customer_id ?? null,
        provider_subscription_id: subscription.id,
        current_period_start: unixToIso(
            subscription.current_start,
        ),
        current_period_end: unixToIso(
            subscription.current_end,
        ),
        updated_at: new Date().toISOString(),
    };

    if (existing) {
        const { error } = await supabase
            .from("subscriptions")
            .update(values)
            .eq("id", existing.id);

        if (error) {
            throw new Error(
                `Subscription update failed: ${error.message}`,
            );
        }

        return existing.id;
    }

    const { data, error } = await supabase
        .from("subscriptions")
        .insert(values)
        .select("id")
        .single();

    if (error || !data) {
        throw new Error(
            `Subscription insert failed: ${error?.message ?? "Unknown error"
            }`,
        );
    }

    return data.id;
}

async function recordPayment(
    payment: RazorpayPayment,
    userId: string,
    planId: string,
    subscriptionId: string,
) {
    if (!payment.id) {
        return;
    }

    const { data: existing, error: existingError } =
        await supabase
            .from("payments")
            .select("id")
            .eq("provider", "razorpay")
            .eq(
                "provider_payment_id",
                payment.id,
            )
            .maybeSingle();

    if (existingError) {
        throw new Error(
            `Payment lookup failed: ${existingError.message}`,
        );
    }

    const paymentStatus =
        payment.status === "captured" ||
            payment.status === "authorized"
            ? "paid"
            : payment.status === "failed"
                ? "failed"
                : "pending";

    const values = {
        user_id: userId,
        subscription_id: subscriptionId,
        plan_id: planId,
        provider: "razorpay",
        provider_payment_id: payment.id,
        amount_inr: Math.round(payment.amount / 100),
        currency: payment.currency,
        status: paymentStatus,
        paid_at:
            paymentStatus === "paid"
                ? unixToIso(payment.created_at) ??
                new Date().toISOString()
                : null,
    };

    if (existing) {
        const { error } = await supabase
            .from("payments")
            .update(values)
            .eq("id", existing.id);

        if (error) {
            throw new Error(
                `Payment update failed: ${error.message}`,
            );
        }

        return;
    }

    const { error } = await supabase
        .from("payments")
        .insert(values);

    if (error) {
        throw new Error(
            `Payment insert failed: ${error.message}`,
        );
    }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: "Method not allowed",
            }),
            {
                status: 405,
                headers: corsHeaders,
            },
        );
    }

    const rawBody = await request.text();

    const signature = request.headers.get(
        "X-Razorpay-Signature",
    );

    const eventId = request.headers.get(
        "x-razorpay-event-id",
    );

    if (!signature) {
        return new Response(
            JSON.stringify({
                error: "Missing webhook signature",
            }),
            {
                status: 400,
                headers: corsHeaders,
            },
        );
    }

    if (!eventId) {
        return new Response(
            JSON.stringify({
                error: "Missing webhook event ID",
            }),
            {
                status: 400,
                headers: corsHeaders,
            },
        );
    }

    const valid = await verifySignature(
        rawBody,
        signature,
    );

    if (!valid) {
        console.error(
            "[RAZORPAY_WEBHOOK] Invalid signature",
        );

        return new Response(
            JSON.stringify({
                error: "Invalid signature",
            }),
            {
                status: 400,
                headers: corsHeaders,
            },
        );
    }

    let payload: RazorpayWebhookPayload;

    try {
        payload = JSON.parse(
            rawBody,
        ) as RazorpayWebhookPayload;
    } catch {
        return new Response(
            JSON.stringify({
                error: "Invalid JSON payload",
            }),
            {
                status: 400,
                headers: corsHeaders,
            },
        );
    }

    const eventType = payload.event;

    console.log(
        JSON.stringify({
            scope: "razorpay_webhook",
            eventId,
            eventType,
        }),
    );

    const { error: eventError } = await supabase
        .from("payment_webhook_events")
        .insert({
            provider: "razorpay",
            event_id: eventId,
            event_type: eventType,
        });

    if (eventError) {
        if (eventError.code === "23505") {
            return new Response(
                JSON.stringify({
                    ok: true,
                    duplicate: true,
                }),
                {
                    status: 200,
                    headers: corsHeaders,
                },
            );
        }

        console.error(
            "[RAZORPAY_WEBHOOK] Event insert failed",
            eventError,
        );

        return new Response(
            JSON.stringify({
                error: "Unable to record webhook event",
            }),
            {
                status: 500,
                headers: corsHeaders,
            },
        );
    }

    try {
        const subscription =
            payload.payload?.subscription?.entity;

        const payment =
            payload.payload?.payment?.entity;

        if (!subscription) {
            return new Response(
                JSON.stringify({
                    ok: true,
                    ignored: true,
                }),
                {
                    status: 200,
                    headers: corsHeaders,
                },
            );
        }

        const userId = extractUserId(subscription);

        if (!userId) {
            throw new Error(
                `Missing user_id in Razorpay subscription ${subscription.id}`,
            );
        }

        const plan = await resolvePlan(
            subscription.plan_id,
        );

        const subscriptionId =
            await upsertSubscription(
                subscription,
                plan.id,
                userId,
            );

        if (payment) {
            await recordPayment(
                payment,
                userId,
                plan.id,
                subscriptionId,
            );
        }

        console.log(
            JSON.stringify({
                scope: "razorpay_webhook",
                eventId,
                eventType,
                userId,
                planId: plan.id,
                subscriptionId,
                razorpaySubscriptionId:
                    subscription.id,
                paymentId: payment?.id ?? null,
            }),
        );

        return new Response(
            JSON.stringify({
                ok: true,
            }),
            {
                status: 200,
                headers: corsHeaders,
            },
        );
    } catch (error) {
        console.error(
            "[RAZORPAY_WEBHOOK] Processing failed",
            error,
        );

        // Remove the event claim so Razorpay can retry
        // the event and process it successfully.
        await supabase
            .from("payment_webhook_events")
            .delete()
            .eq("provider", "razorpay")
            .eq("event_id", eventId);

        return new Response(
            JSON.stringify({
                error: "Webhook processing failed",
            }),
            {
                status: 500,
                headers: corsHeaders,
            },
        );
    }
  },
};
