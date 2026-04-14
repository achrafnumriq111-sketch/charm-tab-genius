
-- 1. Weather daily observations
CREATE TABLE public.weather_daily_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_key text NOT NULL DEFAULT 'amsterdam',
  date date NOT NULL,
  source text NOT NULL DEFAULT 'apple-weatherkit',
  condition_code text,
  condition_label text,
  min_temp_c numeric,
  max_temp_c numeric,
  avg_temp_c numeric,
  humidity numeric,
  wind_speed numeric,
  precipitation_chance numeric,
  cloud_cover numeric,
  pressure numeric,
  visibility numeric,
  uv_index numeric,
  is_rain boolean DEFAULT false,
  is_storm boolean DEFAULT false,
  is_severe boolean DEFAULT false,
  sunrise_time timestamptz,
  sunset_time timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, location_key)
);

ALTER TABLE public.weather_daily_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read weather_daily" ON public.weather_daily_observations FOR SELECT USING (true);
CREATE POLICY "Public insert weather_daily" ON public.weather_daily_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update weather_daily" ON public.weather_daily_observations FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_weather_daily_date ON public.weather_daily_observations(date);

-- 2. Weather hourly observations
CREATE TABLE public.weather_hourly_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_key text NOT NULL DEFAULT 'amsterdam',
  datetime_hour timestamptz NOT NULL,
  date date NOT NULL,
  local_hour smallint NOT NULL,
  condition_code text,
  condition_label text,
  temperature_c numeric,
  feels_like_c numeric,
  humidity numeric,
  wind_speed numeric,
  precipitation_chance numeric,
  precipitation_intensity numeric DEFAULT 0,
  cloud_cover numeric,
  pressure numeric,
  visibility numeric,
  uv_index numeric,
  is_daylight boolean DEFAULT true,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(datetime_hour, location_key)
);

ALTER TABLE public.weather_hourly_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read weather_hourly" ON public.weather_hourly_observations FOR SELECT USING (true);
CREATE POLICY "Public insert weather_hourly" ON public.weather_hourly_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update weather_hourly" ON public.weather_hourly_observations FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_weather_hourly_datetime ON public.weather_hourly_observations(datetime_hour);
CREATE INDEX idx_weather_hourly_date ON public.weather_hourly_observations(date);

-- 3. Business daily facts
CREATE TABLE public.business_daily_facts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  omzet numeric NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  avg_order_value numeric NOT NULL DEFAULT 0,
  labor_hours numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  discount_total numeric DEFAULT 0,
  refund_total numeric DEFAULT 0,
  cash_revenue numeric DEFAULT 0,
  card_revenue numeric DEFAULT 0,
  weekday smallint NOT NULL DEFAULT 0,
  week_number smallint NOT NULL DEFAULT 1,
  month smallint NOT NULL DEFAULT 1,
  season text NOT NULL DEFAULT 'winter',
  is_holiday boolean DEFAULT false,
  holiday_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_daily_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read business_daily" ON public.business_daily_facts FOR SELECT USING (true);
CREATE POLICY "Public insert business_daily" ON public.business_daily_facts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update business_daily" ON public.business_daily_facts FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_business_daily_date ON public.business_daily_facts(date);

-- 4. Business hourly facts
CREATE TABLE public.business_hourly_facts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  local_hour smallint NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  omzet numeric NOT NULL DEFAULT 0,
  avg_order_value numeric NOT NULL DEFAULT 0,
  staff_count smallint DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  is_peak boolean DEFAULT false,
  weekday smallint NOT NULL DEFAULT 0,
  is_weekend boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, local_hour)
);

ALTER TABLE public.business_hourly_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read business_hourly" ON public.business_hourly_facts FOR SELECT USING (true);
CREATE POLICY "Public insert business_hourly" ON public.business_hourly_facts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update business_hourly" ON public.business_hourly_facts FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_business_hourly_date ON public.business_hourly_facts(date);

-- 5. Forecast learning metrics
CREATE TABLE public.forecast_learning_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_scope text NOT NULL DEFAULT 'daily',
  forecast_date date NOT NULL,
  forecast_target text NOT NULL DEFAULT 'omzet',
  predicted_value numeric NOT NULL DEFAULT 0,
  actual_value numeric,
  absolute_error numeric,
  percent_error numeric,
  confidence numeric NOT NULL DEFAULT 50,
  contributing_signals jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forecast_learning_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read forecast_learning" ON public.forecast_learning_metrics FOR SELECT USING (true);
CREATE POLICY "Public insert forecast_learning" ON public.forecast_learning_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update forecast_learning" ON public.forecast_learning_metrics FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_forecast_learning_date ON public.forecast_learning_metrics(forecast_date);

-- 6. Weather business correlations (learned pattern cache)
CREATE TABLE public.weather_business_correlations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_key text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'daily',
  category text NOT NULL DEFAULT 'general',
  sample_size integer NOT NULL DEFAULT 0,
  uplift_percent numeric NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  avg_omzet numeric DEFAULT 0,
  avg_orders numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weather_business_correlations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read correlations" ON public.weather_business_correlations FOR SELECT USING (true);
CREATE POLICY "Public insert correlations" ON public.weather_business_correlations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update correlations" ON public.weather_business_correlations FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_correlations_pattern ON public.weather_business_correlations(pattern_key);
