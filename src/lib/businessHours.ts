/**
 * Business hours — runtime configurable per location.
 *
 * Each location stores its own opening hours in `location_settings.opening_hours`
 * as a JSON object keyed by ISO day-of-week (0=Sun, 1=Mon, ..., 6=Sat):
 *
 *   { "1": { "open": 10, "close": 22, "closed": false }, ... }
 *
 * Special values:
 *   - close === 24      → midnight (end of that calendar day)
 *   - closed === true   → closed on that weekday
 *   - open === 0 && close === 24 → open 24h
 *
 * If no schedule is supplied, the helpers fall back to a sane default
 * (the original Saakouk schedule) so legacy code keeps working.
 */

export interface DaySchedule {
  open: number;          // opening hour (0-24)
  close: number;         // closing hour (0-24, 24 = midnight)
  label: string;
  closed?: boolean;
}

export type LocationSchedule = Record<number, DaySchedule>;

const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

const DEFAULT_SCHEDULE: LocationSchedule = {
  0: { open: 12, close: 24, label: "Zo" },
  1: { open: 10, close: 22, label: "Ma" },
  2: { open: 10, close: 22, label: "Di" },
  3: { open: 10, close: 22, label: "Wo" },
  4: { open: 10, close: 22, label: "Do" },
  5: { open: 10, close: 24, label: "Vr" },
  6: { open: 10, close: 24, label: "Za" },
};

/** Normalize a raw JSON value (e.g. from location_settings.opening_hours) into a LocationSchedule. */
export function normalizeSchedule(raw: any): LocationSchedule {
  if (!raw || typeof raw !== "object") return DEFAULT_SCHEDULE;
  const out: LocationSchedule = {} as LocationSchedule;
  for (let d = 0; d < 7; d++) {
    const entry = raw[d] ?? raw[String(d)];
    if (entry && typeof entry === "object") {
      const open = Math.max(0, Math.min(24, Number(entry.open ?? 0)));
      const close = Math.max(0, Math.min(24, Number(entry.close ?? 0)));
      const closed = !!entry.closed || open === close;
      out[d] = { open, close, label: DAY_LABELS[d], closed };
    } else {
      out[d] = { ...DEFAULT_SCHEDULE[d] };
    }
  }
  return out;
}

export function getDefaultSchedule(): LocationSchedule {
  // Return a deep copy so callers can mutate safely.
  const out: LocationSchedule = {} as LocationSchedule;
  for (let d = 0; d < 7; d++) out[d] = { ...DEFAULT_SCHEDULE[d] };
  return out;
}

/** Resolve a per-day schedule from an optional LocationSchedule (falls back to default). */
export function getSchedule(dayOfWeek: number, schedule?: LocationSchedule): DaySchedule {
  const src = schedule ?? DEFAULT_SCHEDULE;
  return src[dayOfWeek] ?? src[1] ?? DEFAULT_SCHEDULE[1];
}

/** Is the location open at all on this weekday? */
export function isOpenDay(dayOfWeek: number, schedule?: LocationSchedule): boolean {
  const s = getSchedule(dayOfWeek, schedule);
  return !s.closed && s.close > s.open;
}

/** Check if a given hour falls within business hours for that day of week */
export function isOpenHour(dayOfWeek: number, hour: number, schedule?: LocationSchedule): boolean {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return false;
  return hour >= s.open && hour < s.close;
}

/** Get array of open hours for a day of week */
export function getOpenHours(dayOfWeek: number, schedule?: LocationSchedule): number[] {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return [];
  const hours: number[] = [];
  for (let h = s.open; h < s.close; h++) hours.push(h);
  return hours;
}

/** Get total open hours for a day of week */
export function getTotalOpenHours(dayOfWeek: number, schedule?: LocationSchedule): number {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return 0;
  return s.close - s.open;
}

/** Format schedule for display */
export function formatSchedule(dayOfWeek: number, schedule?: LocationSchedule): string {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return "Gesloten";
  if (s.open === 0 && s.close === 24) return "24 uur open";
  const closeStr = s.close === 24 ? "00:00" : `${String(s.close).padStart(2, "0")}:00`;
  return `${String(s.open).padStart(2, "0")}:00 – ${closeStr}`;
}
