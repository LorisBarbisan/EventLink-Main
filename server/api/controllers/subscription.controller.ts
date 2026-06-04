import type { Request, Response } from "express";
import Stripe from "stripe";
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
  getTierFromPriceId,
} from "../services/stripe.service.js";
import { storage } from "../../storage.js";

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const user = await storage.getUser(employerId);
    const profile = await storage.getRecruiterProfile(employerId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const tier = req.body.tier === "teams" ? "teams" : "pro";
    const name = (profile as any)?.company_name ?? user.first_name ?? "Employer";
    const url = await createCheckoutSession(employerId, user.email, name, tier);
    return res.json({ url });
  } catch (err: any) {
    console.error("createCheckout error:", err.message);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
};

export const openPortal = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const sub = await storage.getSubscription(employerId);
    if (!sub) return res.status(404).json({ error: "No subscription found" });
    const url = await createPortalSession(sub.stripeCustomerId);
    return res.json({ url });
  } catch (err: any) {
    console.error("openPortal error:", err.message);
    return res.status(500).json({ error: "Failed to open billing portal" });
  }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });

    // When Stripe is not configured, treat all employers as subscribed so
    // FMS features are accessible (dev / self-hosted without payment setup)
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ subscribed: true, tier: "pro", status: "active" });
    }

    const sub = await storage.getSubscription(employerId);
    if (!sub) return res.json({ subscribed: false, tier: null, status: null });
    return res.json({
      subscribed: sub.status === "active" || sub.status === "trialing",
      tier: sub.tier,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    });
  } catch (err: any) {
    console.error("getSubscriptionStatus error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const employerId = parseInt(sub.metadata?.employerId ?? "0");
        if (!employerId) break;
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = getTierFromPriceId(priceId);
        await storage.upsertSubscription({
          employerId,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          tier,
          status: sub.status as any,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        if (tier === "teams") {
          try {
            const employer = await storage.getUser(employerId);
            const profile = await storage.getRecruiterProfile(employerId);
            const teamName =
              profile?.company_name ?? employer?.first_name ?? "My Team";
            await storage.createTeamAccount(employerId, teamName);
          } catch (teamErr: any) {
            console.error("Auto-create team account failed:", teamErr.message);
          }
        }
        console.log(`Subscription ${event.type} for employer ${employerId}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const employerId = parseInt(sub.metadata?.employerId ?? "0");
        if (!employerId) break;
        await storage.upsertSubscription({
          employerId,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          status: "canceled",
          cancelAtPeriodEnd: false,
        });
        console.log(`Subscription cancelled for employer ${employerId}`);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const existing = await storage.getSubscriptionByStripeCustomerId(customerId);
        if (existing) {
          await storage.upsertSubscription({
            employerId: existing.employerId,
            stripeCustomerId: customerId,
            status: "past_due",
          });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const existing = await storage.getSubscriptionByStripeCustomerId(customerId);
        if (existing && existing.status === "past_due") {
          await storage.upsertSubscription({
            employerId: existing.employerId,
            stripeCustomerId: customerId,
            status: "active",
          });
        }
        break;
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
    return res.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};
