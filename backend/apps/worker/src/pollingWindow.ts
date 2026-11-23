export type PollingPhase =
  | "before_window" // before 15:00 IST (waiting for draw time)
  | "peak" // 15:00 to 17:30 IST (poll every 2 minutes)
  | "evening" // 17:30 to 21:00 IST (poll every 10 minutes)
  | "night" // 21:00 to 06:00 IST (poll every 60 minutes)
  | "expired"; // after 06:00 IST next morning

export interface PollingWindowInfo {
  phase: PollingPhase;
  intervalMinutes: number | null;
  istTimeStr: string;
  istDateStr: string;
  hoursIST: number;
  minutesIST: number;
  totalMinutesIST: number;
  shouldAlert: boolean;
}

/**
 * Parses a Date into IST components (Asia/Kolkata timezone).
 */
export function getISTDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dateStr: string;
  timeStr: string;
  totalMinutes: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hours = parseInt(partMap.hour, 10);
  const minutes = parseInt(partMap.minute, 10);
  const seconds = parseInt(partMap.second, 10);

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const totalMinutes = hours * 60 + minutes;

  return { year, month, day, hours, minutes, seconds, dateStr, timeStr, totalMinutes };
}

/**
 * Calculates the current polling window phase and frequency in IST
 * according to Section 6 and Section 9 of the design doc:
 * - 15:00 - 17:30 IST: peak window, poll every 2 minutes
 * - 17:30 - 21:00 IST: evening window, poll every 10 minutes
 * - 21:00 - 06:00 IST: night window, poll every 60 minutes
 * - 06:00 - 15:00 IST: idle window before draw starts
 * - Alert threshold: 18:30 IST ("no draw published by 6:30 pm")
 */
export function getPollingWindowInfo(now: Date = new Date()): PollingWindowInfo {
  const { hours, minutes, totalMinutes, dateStr, timeStr } = getISTDateParts(now);

  let phase: PollingPhase;
  let intervalMinutes: number | null = null;

  // 15:00 = 900 minutes
  // 17:30 = 1050 minutes
  // 18:30 = 1110 minutes
  // 21:00 = 1260 minutes
  // 06:00 = 360 minutes

  if (totalMinutes < 900 && totalMinutes >= 360) {
    // 06:00 to 15:00 IST
    phase = "before_window";
    intervalMinutes = null;
  } else if (totalMinutes >= 900 && totalMinutes < 1050) {
    // 15:00 to 17:30 IST
    phase = "peak";
    intervalMinutes = 2;
  } else if (totalMinutes >= 1050 && totalMinutes < 1260) {
    // 17:30 to 21:00 IST
    phase = "evening";
    intervalMinutes = 10;
  } else {
    // 21:00 to 06:00 IST
    phase = "night";
    intervalMinutes = 60;
  }

  // Section 9 alert: "No draw published by 6:30 pm" (18:30 IST = 1110 totalMinutes until 06:00 IST next morning)
  const shouldAlert = totalMinutes >= 1110 || hours < 6;

  return {
    phase,
    intervalMinutes,
    istTimeStr: timeStr,
    istDateStr: dateStr,
    hoursIST: hours,
    minutesIST: minutes,
    totalMinutesIST: totalMinutes,
    shouldAlert,
  };
}
