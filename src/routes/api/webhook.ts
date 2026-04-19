import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// POST /api/webhook
// Called by Stripe after every payment event.
// Uses the SERVICE ROLE key to bypass RLS and write directly to the DB.
export const APIRoute = createAPIFileRoute("/api/webhook")({
  POST: async ({ request }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
      console.error("Webhook: missing environment variables");
      return new Response("Server misconfigured", { status: 500 });
    }

    // Stripe requires the RAW body for signature verification — read as text
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-06-30.basil" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", msg);
      return new Response(`Webhook Error: ${msg}`, { status: 400 });
    }

    // Only process successful payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, badgeId } = session.metadata ?? {};

      if (!userId || !badgeId) {
        console.error("Webhook: missing metadata on session", session.id);
        return new Response("Missing metadata", { status: 400 });
      }

      // Use service role to bypass RLS — safe here because this runs server-side
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // 1. Log the order (idempotent — stripe_session_id is UNIQUE)
      const { error: orderError } = await supabase.from("orders").upsert(
        {
          user_id: userId,
          badge_id: badgeId,
          stripe_session_id: session.id,
          amount_cents: session.amount_total ?? 0,
          status: "paid",
          paid_at: new Date().toISOString(),
        },
        { onConflict: "stripe_session_id" }, // idempotent — safe to replay
      );

      if (orderError) {
        console.error("Webhook: failed to insert order:", orderError.message);
        // Return 200 anyway so Stripe doesn't keep retrying — log and investigate manually
      }

      // 2. Grant the badge (also idempotent — UNIQUE(user_id, badge_id))
      const { error: badgeError } = await supabase
        .from("user_badges")
        .upsert({ user_id: userId, badge_id: badgeId }, { onConflict: "user_id,badge_id" });

      if (badgeError) {
        console.error("Webhook: failed to grant badge:", badgeError.message);
      } else {
        console.log(`Webhook: granted badge ${badgeId} to user ${userId}`);
      }
    }

    // Always return 200 — Stripe retries on non-2xx responses
    return new Response("ok", { status: 200 });
  },
});
