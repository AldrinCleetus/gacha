/**
 * Returns today's date in IST formatted as YYYY-MM-DD.
 */
export function getTodayIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns weekday in 1 (Mon) ... 7 (Sun) format for a YYYY-MM-DD date string.
 */
export function getWeekdayFromDate(dateStr: string): number {
  // Parse in IST noon to avoid any midnight timezone shifting
  const date = new Date(`${dateStr}T12:00:00+05:30`);
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return day === 0 ? 7 : day;
}

export const WEEKDAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};
