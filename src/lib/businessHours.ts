/**
 * Saakouk business hours — single source of truth.
 * 
 * Mon-Thu: 10:00–22:00
 * Fri-Sat: 10:00–00:00 (next day)
 * Sun:     12:00–00:00 (next day)
 */

export interface DaySchedule {
  open: number;  // opening hour (0-23)
  close: number; // closing hour (0-24, 24 = midnight / 0 next day)
  label: string;
}

// dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
const SCHEDULE: Record<number, DaySchedule> = {
  0: { open: 12, close: 24, label: "Zo" },  // Sunday
  1: { open: 10, close: 22, label: "Ma" },  // Monday
  2: { open: 10, close: 22, label: "Di" },  // Tuesday
  3: { open: 10, close: 22, label: "Wo" },  // Wednesday
  4: { open: 10, close: 22, label: "Do" },  // Thursday
  5: { open: 10, close: 24, label: "Vr" },  // Friday
  6: { open: 10, close: 24, label: "Za" },  // Saturday
};

export function getSchedule(dayOfWeek: number): DaySchedule {
  return SCHEDULE[dayOfWeek] ?? SCHEDULE[1];
}

/** Check if a given hour falls within business hours for that day of week */
export function isOpenHour(dayOfWeek: number, hour: number): boolean {
  const s = getSchedule(dayOfWeek);
  return hour >= s.open && hour < s.close;
}

/** Get array of open hours for a day of week */
export function getOpenHours(dayOfWeek: number): number[] {
  const s = getSchedule(dayOfWeek);
  const hours: number[] = [];
  for (let h = s.open; h < s.close; h++) {
    hours.push(h);
  }
  return hours;
}

/** Get total open hours for a day of week */
export function getTotalOpenHours(dayOfWeek: number): number {
  const s = getSchedule(dayOfWeek);
  return s.close - s.open;
}

/** Format schedule for display */
export function formatSchedule(dayOfWeek: number): string {
  const s = getSchedule(dayOfWeek);
  const closeStr = s.close === 24 ? "00:00" : `${s.close}:00`;
  return `${s.open}:00 – ${closeStr}`;
}
