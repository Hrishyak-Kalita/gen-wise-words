import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const RAZORPAY_WEBHOOK_SECRET = process.env["RAZORPAY_WEBHOOK_SECRET"];

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not configured");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
}

if (!RAZORPAY_WEBHOOK_SECRET) {
  throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

type RazorpaySubscriptionEntity = {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  total_count?: number | null;
  paid_count?: number | null;
  notes?: Record<string, unknown> | unknown[] | null;
};

type RazorpayPaymentEntity = {
  id: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  created_at?: number | null;
};

type RazorpayWebhookPayload = {
  entity?: string;
  event?: string;
  payload?: {
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
};

function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
): boolean {
  const expectedSignature = createHmac(
    "sha256",
    RAZORPAY_WEBHOOK_SECRET!,
  )
    .update(rawBody)
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(receivedSignature, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

function getUserId(
  notes: RazorpaySubscriptionEntity["notes"],
): string | null {
  if (!notes || Array.isArray(notes) || typeof notes !== "object") {
    return null;
  }

  const userId = notes["user_id"];

  return typeof userId === "string" && userId.length > 0
    ? userId
    : null;
}

function mapSubscriptionStatus(status: string): string {
  switch (status) {
    case "authenticated":
      return "pending";

    case "active":
      return "active";

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

  // Do not let an out-of-order event downgrade an active subscription.
  if (
    currentStatus === "active" &&
    (nextStatus === "pending" || nextStatus === "halted")
  ) {
    return false;
  }

  // Terminal states should not be reopened by an older event.
  if (
    ["cancelled", "completed", "expired"].includes(currentStatus) &&
    ["pending", "halted", "active"].includes(nextStatus)
  ) {
    return false;
  }

  return true;
}

export const Route = createFileRoute("/api/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const signature = request.headers.get("x-razorpay-signature");
        const eventId = request.headers.get("x-razorpay-event-id");

        if (!signature) {
          return Response.json(
            { error: "Missing webhook signature" },
            { status: 400 },
          );
        }

        if (!eventId) {
          return Response.json(
            { error: "Missing webhook event ID" },
            { status: 400 },
          );
        }

        if (!verifyWebhookSignature(rawBody, signature)) {
          console.error(
            JSON.stringify({
              scope: "payment",
              event: "razorpay_webhook_invalid_signature",
            }),
          );

          return Response.json(
            { error: "Invalid webhook signature" },
            { status: 401 },
          );
        }

        let payload: RazorpayWebhookPayload;

        try {
          payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
        } catch {
          return Response.json(
            { error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        const eventType = payload.event;

        if (!eventType) {
          return Response.json(
            { error: "Missing event type" },
            { status: 400 },
          );
        }

        console.log(
          JSON.stringify({
            scope: "payment",
            event: "razorpay_webhook_received",
            eventType,
            eventId,
          }),
        );

        // Claim the event before processing it.
        const { error: eventInsertError } = await supabase
          .from("payment_webhook_events")
          .insert({
            provider: "razorpay",
            event_id: eventId,
            event_type: eventType,
          });

        if (eventInsertError) {
          // Unique constraint means Razorpay delivered this event before.
          if (eventInsertError.code === "23505") {
            return Response.json({
              received: true,
              duplicate: true,
            });
          }

          console.error(
            JSON.stringify({
              scope: "payment",
              event: "webhook_event_claim_failed",
              eventId,
              error: eventInsertError.message,
            }),
          );

          return Response.json(
            { error: "Unable to record webhook event" },
            { status: 500 },
          );
        }

        try {
          const subscription =
            payload.payload?.subscription?.entity;

          const payment =
            payload.payload?.payment?.entity;

          /*
           * Subscription events:
           *
           * authenticated
           * activated
           * resumed
           * pending
           * halted
           * cancelled
           * completed
           * updated
           * charged
           */
          const subscriptionEvents = new Set([
            "subscription.authenticated",
            "subscription.activated",
            "subscription.resumed",
            "subscription.pending",
            "subscription.halted",
            "subscription.cancelled",
            "subscription.completed",
            "subscription.updated",
            "subscription.charged",
          ]);

          if (subscriptionEvents.has(eventType)) {
            if (!subscription?.id || !subscription.plan_id) {
              throw new Error(
                "Webhook does not contain a valid subscription entity",
              );
            }

            const userId = getUserId(subscription.notes);

            if (!userId) {
              throw new Error(
                `Missing user_id in Razorpay subscription notes for ${subscription.id}`,
              );
            }

            const { data: plan, error: planError } = await supabase
              .from("plans")
              .select("id, slug, razorpay_plan_id")
              .eq("razorpay_plan_id", subscription.plan_id)
              .eq("active", true)
              .maybeSingle();

            if (planError) {
              throw new Error(
                `Plan lookup failed: ${planError.message}`,
              );
            }

            if (!plan) {
              throw new Error(
                `No active Draftwell plan for Razorpay plan ${subscription.plan_id}`,
              );
            }

            const nextStatus = mapSubscriptionStatus(
              subscription.status,
            );

            const { data: existingSubscription, error: lookupError } =
              await supabase
                .from("subscriptions")
                .select(
                  "id, user_id, plan_id, status, provider_subscription_id",
                )
                .eq(
                  "provider_subscription_id",
                  subscription.id,
                )
                .eq("provider", "razorpay")
                .maybeSingle();

            if (lookupError) {
              throw new Error(
                `Subscription lookup failed: ${lookupError.message}`,
              );
            }

            const currentStatus =
              existingSubscription?.status ?? null;

            const updateStatus = shouldUpdateStatus(
              currentStatus,
              nextStatus,
            );

            const subscriptionData = {
              user_id: userId,
              plan_id: plan.id,
              provider: "razorpay",
              provider_subscription_id: subscription.id,
              provider_customer_id:
                subscription.customer_id ?? null,
              current_period_start: subscription.current_start
                ? new Date(
                    subscription.current_start * 1000,
                  ).toISOString()
                : null,
              current_period_end: subscription.current_end
                ? new Date(
                    subscription.current_end * 1000,
                  ).toISOString()
                : null,
              ...(updateStatus ? { status: nextStatus } : {}),
              updated_at: new Date().toISOString(),
            };

            if (existingSubscription) {
              const { error: updateError } = await supabase
                .from("subscriptions")
                .update(subscriptionData)
                .eq("id", existingSubscription.id);

              if (updateError) {
                throw new Error(
                  `Subscription update failed: ${updateError.message}`,
                );
              }
            } else {
              const { error: insertError } = await supabase
                .from("subscriptions")
                .insert({
                  ...subscriptionData,
                  status: nextStatus,
                });

              if (insertError) {
                throw new Error(
                  `Subscription insert failed: ${insertError.message}`,
                );
              }
            }

            console.log(
              JSON.stringify({
                scope: "payment",
                event: "subscription_synced",
                eventType,
                eventId,
                razorpaySubscriptionId: subscription.id,
                userId,
                planSlug: plan.slug,
                status: updateStatus
                  ? nextStatus
                  : currentStatus,
              }),
            );
          }

          /*
           * subscription.charged and subscription.completed
           * can contain a payment entity.
           */
          if (
            payment?.id &&
            subscription?.id &&
            ["subscription.charged", "subscription.completed"].includes(
              eventType,
            )
          ) {
            const { data: subscriptionRow, error: subscriptionLookupError } =
              await supabase
                .from("subscriptions")
                .select("id, user_id, plan_id")
                .eq(
                  "provider_subscription_id",
                  subscription.id,
                )
                .eq("provider", "razorpay")
                .maybeSingle();

            if (subscriptionLookupError) {
              throw new Error(
                `Payment subscription lookup failed: ${subscriptionLookupError.message}`,
              );
            }

            if (!subscriptionRow) {
              throw new Error(
                `Cannot record payment: subscription ${subscription.id} not found`,
              );
            }

            const { data: existingPayment, error: paymentLookupError } =
              await supabase
                .from("payments")
                .select("id")
                .eq("provider", "razorpay")
                .eq("provider_payment_id", payment.id)
                .maybeSingle();

            if (paymentLookupError) {
              throw new Error(
                `Payment lookup failed: ${paymentLookupError.message}`,
              );
            }

            if (!existingPayment) {
              const { error: paymentInsertError } = await supabase
                .from("payments")
                .insert({
                  user_id: subscriptionRow.user_id,
                  subscription_id: subscriptionRow.id,
                  plan_id: subscriptionRow.plan_id,
                  provider: "razorpay",
                  provider_payment_id: payment.id,
                  amount_inr: Math.round(
                    payment.amount ?? 0,
                  ),
                  currency: payment.currency ?? "INR",
                  status: payment.status ?? "captured",
                  paid_at: payment.created_at
                    ? new Date(
                        payment.created_at * 1000,
                      ).toISOString()
                    : new Date().toISOString(),
                });

              if (paymentInsertError) {
                throw new Error(
                  `Payment insert failed: ${paymentInsertError.message}`,
                );
              }
            }
          }

          console.log(
            JSON.stringify({
              scope: "payment",
              event: "razorpay_webhook_processed",
              eventType,
              eventId,
            }),
          );

          return Response.json({
            received: true,
          });
        } catch (error) {
          // Remove the event claim so Razorpay can retry after a
          // processing failure.
          await supabase
            .from("payment_webhook_events")
            .delete()
            .eq("provider", "razorpay")
            .eq("event_id", eventId);

          console.error(
            JSON.stringify({
              scope: "payment",
              event: "razorpay_webhook_processing_failed",
              eventId,
              eventType,
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            }),
          );

          return Response.json(
            { error: "Webhook processing failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});