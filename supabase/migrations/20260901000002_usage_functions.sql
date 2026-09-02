-- ============================================================
-- Atomic usage / credit functions
-- V1
-- ============================================================

-- Consume one generation credit atomically.
-- Uses the user's active subscription plan when available.
-- Falls back to the Free plan when the user has no subscription.

CREATE OR REPLACE FUNCTION public.consume_generation_credit(
  p_user_id UUID
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  monthly_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', CURRENT_DATE)::date;
  v_monthly_limit INTEGER;
  v_generation_count INTEGER;
BEGIN

  -- Prefer the user's active subscription.
  SELECT p.monthly_generations
  INTO v_monthly_limit
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND p.active = true
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Beta fallback: Free plan.
  IF v_monthly_limit IS NULL THEN
    SELECT monthly_generations
    INTO v_monthly_limit
    FROM public.plans
    WHERE slug = 'free'
      AND active = true
    LIMIT 1;
  END IF;

  IF v_monthly_limit IS NULL THEN
    RAISE EXCEPTION 'No active usage plan configured';
  END IF;

  -- Create the monthly usage row if it doesn't exist.
  INSERT INTO public.usage (
    user_id,
    period_start,
    generation_count
  )
  VALUES (
    p_user_id,
    v_period_start,
    0
  )
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Lock the user's current usage row.
  SELECT generation_count
  INTO v_generation_count
  FROM public.usage
  WHERE user_id = p_user_id
    AND period_start = v_period_start
  FOR UPDATE;

  -- Monthly limit reached.
  IF v_generation_count >= v_monthly_limit THEN
    RETURN QUERY
    SELECT
      false,
      0,
      v_monthly_limit;
    RETURN;
  END IF;

  -- Consume exactly one credit.
  UPDATE public.usage
  SET
    generation_count = generation_count + 1,
    updated_at = now()
  WHERE user_id = p_user_id
    AND period_start = v_period_start;

  RETURN QUERY
  SELECT
    true,
    v_monthly_limit - v_generation_count - 1,
    v_monthly_limit;
END;
$$;


-- Refund one generation credit.
-- Used when Gemini fails after a credit was reserved.

CREATE OR REPLACE FUNCTION public.refund_generation_credit(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN

  UPDATE public.usage
  SET
    generation_count = GREATEST(generation_count - 1, 0),
    updated_at = now()
  WHERE user_id = p_user_id
    AND period_start = v_period_start
    AND generation_count > 0;

  RETURN FOUND;
END;
$$;


-- These functions are called from the authenticated server flow.
REVOKE ALL ON FUNCTION public.consume_generation_credit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_generation_credit(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_generation_credit(UUID)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.refund_generation_credit(UUID)
TO authenticated, service_role;