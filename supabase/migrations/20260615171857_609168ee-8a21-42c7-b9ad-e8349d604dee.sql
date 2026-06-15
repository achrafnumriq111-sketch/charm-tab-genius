CREATE OR REPLACE FUNCTION public.report_pnl(
  _location_id uuid,
  _start timestamptz,
  _end timestamptz,
  _vat_rate numeric DEFAULT 9
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.location_in_user_tenant(_location_id, _user_id) OR public.is_platform_admin(_user_id)) THEN
    RAISE EXCEPTION 'Location not in user tenant';
  END IF;

  WITH tx AS (
    SELECT
      total::numeric AS total,
      subtotal::numeric AS subtotal,
      discount::numeric AS discount,
      tip::numeric AS tip,
      gift_card_deduction::numeric AS gift_card_deduction,
      payment_method,
      created_at
    FROM public.pos_transactions
    WHERE location_id = _location_id
      AND status = 'completed'
      AND created_at >= _start
      AND created_at < _end
  ),
  agg AS (
    SELECT
      COUNT(*)::int AS tx_count,
      COALESCE(SUM(total), 0)::numeric AS gross_total,
      COALESCE(SUM(subtotal), 0)::numeric AS gross_subtotal,
      COALESCE(SUM(discount), 0)::numeric AS discounts,
      COALESCE(SUM(tip), 0)::numeric AS tips,
      COALESCE(SUM(gift_card_deduction), 0)::numeric AS gift_card_used,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0)::numeric AS cash_revenue,
      COALESCE(SUM(CASE WHEN payment_method IN ('card','pin','ideal') THEN total ELSE 0 END), 0)::numeric AS card_revenue,
      COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash','card','pin','ideal') THEN total ELSE 0 END), 0)::numeric AS other_revenue
    FROM tx
  )
  SELECT jsonb_build_object(
    'period_start', _start,
    'period_end', _end,
    'vat_rate_assumed', _vat_rate,
    'transactions', tx_count,
    'gross_revenue_incl_vat', round(gross_subtotal, 2),
    'vat_collected', round(gross_subtotal - (gross_subtotal / (1 + _vat_rate / 100)), 2),
    'net_revenue_excl_vat', round(gross_subtotal / (1 + _vat_rate / 100), 2),
    'discounts', round(discounts, 2),
    'tips', round(tips, 2),
    'gift_card_used', round(gift_card_used, 2),
    'avg_order_value', CASE WHEN tx_count > 0 THEN round(gross_total / tx_count, 2) ELSE 0 END,
    'cash_revenue', round(cash_revenue, 2),
    'card_revenue', round(card_revenue, 2),
    'other_revenue', round(other_revenue, 2),
    'total_collected', round(gross_total, 2)
  ) INTO _result
  FROM agg;

  RETURN _result;
END;
$function$;