/**
 * Business hours — runtime configurable per location.
 *
 * Storage shape in `location_settings.opening_hours` (JSONB):
 *
 *   {
 *     "days": {
 *       "0": { "open": 12, "close": 24, "closed": false },
 *       "1": { "open": 7, "close": 26, "closed": false },   // 07:00 → 02:00 next day
 *       ...
 *     },
 *     "exceptions": {
 *       "2026-12-25": { "open": 0, "close": 0, "closed": true, "label": "1e Kerstdag" },
 *       "2026-12-31": { "open": 10, "close": 28, "closed": false, "label": "Oudejaar" }
 *     }
 *   }
 *
 * Legacy shape (numeric keys at top level) is still accepted for backward compat.
 *
 * Special values:
 *   - close === 24       → midnight (end of that calendar day)
 *   - close > 24         → crosses midnight (close - 24 == next-day hour)
 *   - closed === true    → closed
 *   - open === 0 && close === 24 → open 24h
 */

export interface DaySchedule {
  open: number;          // 0-23 opening hour
  close: number;         // 1-30 closing hour (24=midnight, 26=02:00 next day, max 30)
  label: string;
  closed?: boolean;
}

export type LocationSchedule = Record<number, DaySchedule>;

export interface ScheduleException {
  open: number;
  close: number;
  closed: boolean;
  label?: string;
}

export interface ScheduleConfig {
  days: LocationSchedule;
  exceptions: Record<string, ScheduleException>; // date "YYYY-MM-DD" → override
}

const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
export const DAY_LABELS_LONG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

const DEFAULT_DAYS: LocationSchedule = {
  0: { open: 12, close: 24, label: "Zo" },
  1: { open: 10, close: 22, label: "Ma" },
  2: { open: 10, close: 22, label: "Di" },
  3: { open: 10, close: 22, label: "Wo" },
  4: { open: 10, close: 22, label: "Do" },
  5: { open: 10, close: 24, label: "Vr" },
  6: { open: 10, close: 24, label: "Za" },
};

// ─── Normalization ───────────────────────────────────────────────────────────

function clampOpen(v: any): number { return Math.max(0, Math.min(23, Number(v) || 0)); }
function clampClose(v: any): number { return Math.max(0, Math.min(30, Number(v) || 0)); }

function normalizeDayEntry(entry: any, dow: number): DaySchedule {
  if (!entry || typeof entry !== "object") return { ...DEFAULT_DAYS[dow] };
  const open = clampOpen(entry.open ?? 0);
  const close = clampClose(entry.close ?? 0);
  const closed = !!entry.closed || close <= open;
  return { open, close, label: DAY_LABELS[dow], closed };
}

/** Accepts legacy (numeric-key map) or new ({days, exceptions}) shape. */
export function normalizeScheduleConfig(raw: any): ScheduleConfig {
  const out: ScheduleConfig = { days: {} as LocationSchedule, exceptions: {} };

  // detect shape
  const daysRaw = (raw && typeof raw === "object" && raw.days && typeof raw.days === "object") ? raw.days : raw;
  for (let d = 0; d < 7; d++) {
    const entry = daysRaw?.[d] ?? daysRaw?.[String(d)];
    out.days[d] = entry ? normalizeDayEntry(entry, d) : { ...DEFAULT_DAYS[d] };
  }

  const excRaw = raw && typeof raw === "object" ? raw.exceptions : null;
  if (excRaw && typeof excRaw === "object") {
    for (const [date, val] of Object.entries(excRaw as any)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !val || typeof val !== "object") continue;
      const v = val as any;
      const open = clampOpen(v.open ?? 0);
      const close = clampClose(v.close ?? 0);
      const closed = !!v.closed || close <= open;
      out.exceptions[date] = { open, close, closed, label: typeof v.label === "string" ? v.label : undefined };
    }
  }
  return out;
}

/** Backward-compat: returns just the days map. */
export function normalizeSchedule(raw: any): LocationSchedule {
  return normalizeScheduleConfig(raw).days;
}

export function getDefaultScheduleConfig(): ScheduleConfig {
  const days: LocationSchedule = {} as LocationSchedule;
  for (let d = 0; d < 7; d++) days[d] = { ...DEFAULT_DAYS[d] };
  return { days, exceptions: {} };
}

export function getDefaultSchedule(): LocationSchedule {
  return getDefaultScheduleConfig().days;
}

// ─── Day-of-week helpers (legacy, used by forecastEngine) ────────────────────

export function getSchedule(dayOfWeek: number, schedule?: LocationSchedule): DaySchedule {
  const src = schedule ?? DEFAULT_DAYS;
  return src[dayOfWeek] ?? src[1] ?? DEFAULT_DAYS[1];
}
export function isOpenDay(dayOfWeek: number, schedule?: LocationSchedule): boolean {
  const s = getSchedule(dayOfWeek, schedule);
  return !s.closed && s.close > s.open;
}
export function isOpenHour(dayOfWeek: number, hour: number, schedule?: LocationSchedule): boolean {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return false;
  if (hour >= s.open && hour < Math.min(24, s.close)) return true;
  // Cross-midnight overflow: hours 0..(close-24-1) on next calendar day are still part of this weekday's shift.
  // Caller using weekday-only context doesn't see those; date-aware helpers below handle it correctly.
  return false;
}
export function getOpenHours(dayOfWeek: number, schedule?: LocationSchedule): number[] {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return [];
  const hours: number[] = [];
  const end = Math.min(24, s.close);
  for (let h = s.open; h < end; h++) hours.push(h);
  return hours;
}
export function getTotalOpenHours(dayOfWeek: number, schedule?: LocationSchedule): number {
  const s = getSchedule(dayOfWeek, schedule);
  if (s.closed || s.close <= s.open) return 0;
  return s.close - s.open; // includes cross-midnight overflow
}

export function formatSchedule(dayOfWeek: number, schedule?: LocationSchedule): string {
  const s = getSchedule(dayOfWeek, schedule);
  return formatDayHours(s);
}

export function formatDayHours(s: DaySchedule | ScheduleException): string {
  if ((s as any).closed || s.close <= s.open) return "Gesloten";
  if (s.open === 0 && s.close === 24) return "24 uur open";
  const openStr = `${String(s.open).padStart(2, "0")}:00`;
  const closeHourMod = s.close % 24 === 0 ? 24 : s.close % 24;
  const wraps = s.close > 24;
  const closeStr = s.close === 24
    ? "00:00"
    : `${String(closeHourMod === 24 ? 0 : closeHourMod).padStart(2, "0")}:00`;
  return `${openStr} – ${closeStr}${wraps ? " (volgende dag)" : ""}`;
}

// ─── Date-aware helpers (handle exceptions + cross-midnight) ─────────────────

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Resolve the schedule for a specific calendar date (exception overrides weekday). */
export function getScheduleForDate(date: Date, cfg: ScheduleConfig): DaySchedule {
  const key = dateStr(date);
  const exc = cfg.exceptions[key];
  if (exc) {
    return {
      open: exc.open,
      close: exc.close,
      label: exc.label || DAY_LABELS[date.getDay()],
      closed: exc.closed,
    };
  }
  return cfg.days[date.getDay()] ?? DEFAULT_DAYS[date.getDay()];
}

/**
 * Hours (0-23) that are open on a specific calendar date.
 * Takes into account:
 *   - the date's own schedule (clipped at 24)
 *   - any cross-midnight overflow from the previous day's schedule
 * Returned hours are sorted ascending.
 */
export function getOpenHoursForDate(date: Date, cfg: ScheduleConfig): number[] {
  const result = new Set<number>();
  // Previous day overflow
  const prev = getScheduleForDate(addDays(date, -1), cfg);
  if (!prev.closed && prev.close > 24) {
    for (let h = 0; h < prev.close - 24; h++) result.add(h);
  }
  // Today's own open hours (up to 24 — anything beyond falls into next calendar day)
  const today = getScheduleForDate(date, cfg);
  if (!today.closed && today.close > today.open) {
    const end = Math.min(24, today.close);
    for (let h = today.open; h < end; h++) result.add(h);
  }
  return Array.from(result).sort((a, b) => a - b);
}

export function isOpenAtDate(date: Date, hour: number, cfg: ScheduleConfig): boolean {
  return getOpenHoursForDate(date, cfg).includes(hour);
}

/** Total open hours for the calendar date (includes prev-day overflow + today's clipped hours). */
export function getTotalOpenHoursForDate(date: Date, cfg: ScheduleConfig): number {
  return getOpenHoursForDate(date, cfg).length;
}

/** Human-readable label for the date's schedule, including (Uitzondering) tag if applicable. */
export function formatScheduleForDate(date: Date, cfg: ScheduleConfig): string {
  const key = dateStr(date);
  const exc = cfg.exceptions[key];
  const s = getScheduleForDate(date, cfg);
  const base = formatDayHours(s);
  return exc ? `${base} · uitzondering${exc.label ? ` (${exc.label})` : ""}` : base;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ScheduleWarning {
  scope: "day" | "exception" | "global";
  key: string;        // day index as string, or date
  message: string;
  severity: "error" | "warning";
}

export function validateScheduleConfig(cfg: ScheduleConfig): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  for (let d = 0; d < 7; d++) {
    const s = cfg.days[d];
    if (!s) continue;
    if (s.closed) continue;
    if (s.close <= s.open) {
      warnings.push({
        scope: "day", key: String(d), severity: "error",
        message: `${DAY_LABELS_LONG[d]}: sluitingsuur (${s.close}) moet groter zijn dan openingsuur (${s.open}).`,
      });
      continue;
    }
    if (s.close > 30) {
      warnings.push({ scope: "day", key: String(d), severity: "error",
        message: `${DAY_LABELS_LONG[d]}: sluitingsuur mag maximaal 30 zijn (= 06:00 volgende dag).` });
    }
    // Cross-midnight overlap with next day's opening
    if (s.close > 24) {
      const next = cfg.days[(d + 1) % 7];
      if (next && !next.closed && next.open < (s.close - 24)) {
        warnings.push({
          scope: "day", key: String(d), severity: "warning",
          message: `${DAY_LABELS_LONG[d]} sluit pas om ${s.close - 24}:00, maar ${DAY_LABELS_LONG[(d + 1) % 7]} opent al om ${next.open}:00. Uren overlappen.`,
        });
      }
    }
  }

  for (const [date, exc] of Object.entries(cfg.exceptions)) {
    if (exc.closed) continue;
    if (exc.close <= exc.open) {
      warnings.push({ scope: "exception", key: date, severity: "error",
        message: `Uitzondering ${date}: sluitingsuur moet groter zijn dan openingsuur.` });
    }
    if (exc.close > 30) {
      warnings.push({ scope: "exception", key: date, severity: "error",
        message: `Uitzondering ${date}: sluitingsuur mag maximaal 30 zijn.` });
    }
  }

  return warnings;
}
