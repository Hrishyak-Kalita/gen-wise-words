-- ============================================================
-- Usage, Plans, Subscriptions and Payments
-- V1 foundation
-- ============================================================

-- ============================================================
-- PLANS
-- ============================================================

CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  monthly_generations INTEGER NOT NULL,
  price_inr INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT plans_monthly_generations_positive
    CHECK (monthly_generations > 0),

  CONSTRAINT plans_price_non_negative
    CHECK (price_inr >= 0)
);

GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_read_active"
ON public.plans
FOR SELECT
TO authenticated
USING (active);


-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),

  status TEXT NOT NULL DEFAULT 'active',

  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,

  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_status_check
    CHECK (
      status IN (
        'active',
        'cancelled',
        'expired',
        'paused',
        'past_due'
      )
    )
);

CREATE INDEX subscriptions_user_idx
ON public.subscriptions(user_id);

CREATE INDEX subscriptions_provider_subscription_idx
ON public.subscriptions(provider_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- ============================================================
-- USAGE
-- ============================================================

CREATE TABLE public.usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id UUID NOT NULL,

  period_start DATE NOT NULL,
  generation_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT usage_generation_count_non_negative
    CHECK (generation_count >= 0),

  CONSTRAINT usage_user_period_unique
    UNIQUE (user_id, period_start)
);

CREATE INDEX usage_user_period_idx
ON public.usage(user_id, period_start DESC);

GRANT SELECT ON public.usage TO authenticated;
GRANT ALL ON public.usage TO service_role;

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_select_own"
ON public.usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,

  provider TEXT NOT NULL,
  provider_payment_id TEXT,

  amount_inr INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',

  status TEXT NOT NULL DEFAULT 'pending',

  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payments_amount_non_negative
    CHECK (amount_inr >= 0),

  CONSTRAINT payments_status_check
    CHECK (
      status IN (
        'pending',
        'paid',
        'failed',
        'refunded'
      )
    )
);

CREATE INDEX payments_user_idx
ON public.payments(user_id, created_at DESC);

CREATE INDEX payments_provider_payment_idx
ON public.payments(provider_payment_id);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own"
ON public.payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER usage_updated_at
BEFORE UPDATE ON public.usage
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- INITIAL FREE PLAN
-- ============================================================

INSERT INTO public.plans (
  name,
  slug,
  description,
  monthly_generations,
  price_inr,
  active
)
VALUES (
  'Free',
  'free',
  'Free beta plan',
  5,
  0,
  true
)
ON CONFLICT (slug) DO NOTHING;