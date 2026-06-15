-- Add per-location opening hours used by AI Forecast (and future scheduling features).
-- Stored as JSONB keyed by ISO day-of-week (0=Sun..6=Sat). Each entry:
--   { "open": <0-24>, "close": <0-24>, "closed": <bool> }
-- close=24 means midnight (end of day). open===close OR closed=true → location is closed that day.
ALTER TABLE public.location_settings
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT
    '{
      "0": {"open": 12, "close": 24, "closed": false},
      "1": {"open": 10, "close": 22, "closed": false},
      "2": {"open": 10, "close": 22, "closed": false},
      "3": {"open": 10, "close": 22, "closed": false},
      "4": {"open": 10, "close": 22, "closed": false},
      "5": {"open": 10, "close": 24, "closed": false},
      "6": {"open": 10, "close": 24, "closed": false}
    }'::jsonb;