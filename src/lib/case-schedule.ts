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

export type RecurringSession = { day: number; time: string; specialist_id: string };
type CaseSchedule = { recurring_sessions?: unknown; recurring_days: number[]; recurring_times?: unknown; recurring_time: string; specialist_id: string };

export function caseSessions(c: CaseSchedule): RecurringSession[] {
  if (Array.isArray(c.recurring_sessions)) return c.recurring_sessions as RecurringSession[];
  return c.recurring_days.map((day) => ({ day, time: dayTime(c.recurring_times, day, c.recurring_time), specialist_id: c.specialist_id }));
}

export function validSessions(sessions: RecurringSession[]) {
  return sessions.length > 0 && sessions.every((s) => /^[0-6]$/.test(String(s.day)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) && Boolean(s.specialist_id)) && new Set(sessions.map((s) => `${s.day}|${s.time}`)).size === sessions.length;
}

export function scheduleFields(sessions: RecurringSession[]) {
  const days = Array.from(new Set(sessions.map((s) => s.day))).sort();
  const times = Object.fromEntries(days.map((day) => [String(day), sessions.find((s) => s.day === day)?.time || "16:00"]));
  return { recurring_sessions: sessions.map((s) => ({ ...s })), recurring_days: days, recurring_times: times, recurring_time: sessions[0]?.time || "16:00" };
}

export function assignedToCase(c: CaseSchedule, specialistId: string) {
  return c.specialist_id === specialistId || caseSessions(c).some((s) => s.specialist_id === specialistId);
}