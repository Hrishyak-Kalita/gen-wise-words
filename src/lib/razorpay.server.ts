import Razorpay from "razorpay";

const keyId = process.env["RAZORPAY_KEY_ID"];
const keySecret = process.env["RAZORPAY_KEY_SECRET"];

if (!keyId || !keySecret) {
  throw new Error("Razorpay server credentials are not configured");
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id?: string | null;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  short_url?: string;
}

export async function createRazorpaySubscription(params: {
  planId: string;
  userId: string;
  userEmail?: string | null;
}): Promise<RazorpaySubscription> {
  const { planId, userId, userEmail } = params;

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 1200,
    quantity: 1,
    customer_notify: true,
    notes: {
      user_id: userId,
      ...(userEmail ? { email: userEmail } : {}),
    },
  });

  return subscription as unknown as RazorpaySubscription;
}