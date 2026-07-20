import type { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../../storage";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2025-06-30.basil" });
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorised" });

    const { period } = req.body as { period: "monthly" | "annual" };
    const priceId =
      period === "annual"
        ? process.env.STRIPE_PRICE_ID_ANNUAL
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) return res.status(500).json({ error: "Stripe price not configured" });

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || "http://localhost:5000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { userId: String(user.id) },
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?cancelled=1`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Customer Portal ─────────────────────────────────────────────────────────

export async function createPortalSession(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorised" });

    const dbUser = await storage.getUser(user.id);
    if (!dbUser?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || "http://localhost:5000";

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe portal error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Subscription Webhook ────────────────────────────────────────────────────

export async function handleWebhook(req: Request, res: Response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      req.headers["stripe-signature"] as string,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.metadata?.userId);
        if (!userId || !session.customer || !session.subscription) break;
        await storage.updateStripeCustomer(
          userId,
          session.customer as string,
          session.subscription as string
        );
        await storage.updateSubscriptionTier(userId, "pro");
        console.log(`✅ Stripe: user ${userId} upgraded to Pro`);
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const dbUser = await storage.getUserByStripeCustomerId(customerId);
        if (dbUser) {
          await storage.updateSubscriptionTier(dbUser.id, "free");
          console.log(`⬇️  Stripe: user ${dbUser.id} downgraded to Free`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const dbUser = await storage.getUserByStripeCustomerId(customerId);
        if (dbUser) {
          const tier = sub.status === "active" ? "pro" : "free";
          await storage.updateSubscriptionTier(dbUser.id, tier);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.json({ received: true });
}

// ─── Identity Verification ───────────────────────────────────────────────────

export async function createIdentitySession(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorised" });
    if (user.role !== "freelancer") return res.status(403).json({ error: "Freelancers only" });

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || "http://localhost:5000";

    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { userId: String(user.id) },
      options: { document: { require_live_capture: true } },
      return_url: `${appUrl}/dashboard?identity=done`,
    });

    await storage.updateIdVerified(user.id, false, session.id);

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Identity error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Identity Webhook ────────────────────────────────────────────────────────

export async function handleIdentityWebhook(req: Request, res: Response) {
  const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: "Identity webhook secret not configured" });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      req.headers["stripe-signature"] as string,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Stripe identity webhook signature error:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    if (event.type === "identity.verification_session.verified") {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const userId = Number(session.metadata?.userId);
      if (userId) {
        await storage.updateIdVerified(userId, true, session.id);
        console.log(`✅ Identity: user ${userId} verified`);
      }
    } else if (event.type === "identity.verification_session.requires_input") {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const userId = Number(session.metadata?.userId);
      if (userId) {
        await storage.updateIdVerified(userId, false, session.id);
        console.log(`⚠️  Identity: user ${userId} verification requires input`);
      }
    }
  } catch (err: any) {
    console.error("Stripe identity webhook handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.json({ received: true });
}
