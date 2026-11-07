export type DayTimes = Record<string, string>;
export const WEEKDAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export function dayTime(times: unknown, day: number, fallback = "16:00"): string {
  const value = times && typeof times === "object" ? (times as Record<string, unknown>)[String(day)] : undefined;
  return (typeof value === "string" ? value : fallback).slice(0, 5);
}

export function selectedDayTimes(days: number[], times: unknown, fallback = "16:00"): DayTimes {
  return Object.fromEntries(days.map((day) => [String(day), dayTime(times, day, fallback)]));
}

export function validDayTimes(days: number[], times: unknown, fallback = "16:00") {
  return days.length > 0 && days.every((day) => /^[0-6]$/.test(String(day)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(dayTime(times, day, fallback)));
}