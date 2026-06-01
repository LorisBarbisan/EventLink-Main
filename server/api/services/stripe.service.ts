import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — Stripe subscription features are disabled");
}

export const stripe = new Stripe(stripeKey ?? "sk_test_disabled", {
  apiVersion: "2024-06-20",
});

const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
  teams: process.env.STRIPE_TEAMS_PRICE_ID ?? "",
};

export async function getOrCreateStripeCustomer(
  employerId: number,
  email: string,
  name: string
): Promise<string> {
  const { storage } = await import("../../storage.js");
  const existing = await storage.getSubscription(employerId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { employerId: String(employerId) },
  });
  return customer.id;
}

export async function createCheckoutSession(
  employerId: number,
  email: string,
  name: string,
  tier: "pro" | "teams"
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(employerId, email, name);
  const priceId = PRICE_IDS[tier];
  if (!priceId) throw new Error(`Price ID not configured for tier: ${tier}`);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { employerId: String(employerId), tier },
    },
    success_url: `${process.env.APP_URL}/dashboard?tab=billing&subscribed=true`,
    cancel_url: `${process.env.APP_URL}/pricing?cancelled=true`,
    metadata: { employerId: String(employerId), tier },
  });
  if (!session.url) throw new Error("No checkout URL returned from Stripe");
  return session.url;
}

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.APP_URL}/dashboard?tab=billing`,
  });
  return session.url;
}

export function getTierFromPriceId(priceId: string): "pro" | "teams" {
  if (priceId === PRICE_IDS.teams) return "teams";
  return "pro";
}
