import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";

// POST /api/checkout
// Body: { badgeId, badgeName, priceInCents, userId }
// Returns: { url } — Stripe Checkout URL
export const APIRoute = createAPIFileRoute("/api/checkout")({
  POST: async ({ request }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { badgeId: string; badgeName: string; priceInCents: number; userId: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { badgeId, badgeName, priceInCents, userId } = body;

    if (!badgeId || !badgeName || !priceInCents || !userId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-06-30.basil" });
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: badgeName,
              description: "VENICEHUB exclusive badge",
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      // Store user + badge in metadata — webhook reads this to grant the badge
      metadata: { userId, badgeId },
      success_url: `${origin}/shop?success=1`,
      cancel_url: `${origin}/shop`,
      // Prevent same user buying same badge twice at checkout level
      payment_intent_data: {
        metadata: { userId, badgeId },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
