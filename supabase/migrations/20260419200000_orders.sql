-- =====================================================
-- ORDERS TABLE
-- Tracks every Stripe payment. stripe_session_id is UNIQUE
-- so webhook replays are idempotent (safe to retry).
-- =====================================================
CREATE TABLE public.orders (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id           UUID        NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  stripe_session_id  TEXT        UNIQUE NOT NULL,
  amount_cents       INTEGER     NOT NULL DEFAULT 0,
  status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at            TIMESTAMPTZ
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_orders_user   ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Users can view their own order history
CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all orders (for revenue reporting)
CREATE POLICY "Admins view all orders"
  ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Only the service role (webhook) can insert/update — no client policy needed.
-- The webhook uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
