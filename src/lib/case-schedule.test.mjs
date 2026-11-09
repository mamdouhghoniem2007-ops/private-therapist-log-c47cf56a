import { describe, expect, test } from "bun:test";
import { dayTime, selectedDayTimes, validDayTimes, caseSessions, validSessions, scheduleFields, assignedToCase } from "./case-schedule";

describe("child weekday appointment times", () => {
  test("two sessions on Saturday retain separate times and specialists in one schedule", () => {
    const sessions = [{ day: 6, time: "10:00", specialist_id: "first" }, { day: 6, time: "17:30", specialist_id: "second" }];
    expect(validSessions(sessions)).toBe(true);
    expect(scheduleFields(sessions).recurring_sessions).toEqual(sessions);
    expect(scheduleFields(sessions).recurring_days).toEqual([6]);
    expect(assignedToCase({ ...scheduleFields(sessions), specialist_id: "first" }, "second")).toBe(true);
    expect(assignedToCase({ ...scheduleFields(sessions), specialist_id: "first" }, "unassigned")).toBe(false);
  });
  test("removing a second session keeps the first and legacy schedules stay intact", () => {
    expect(caseSessions({ recurring_days: [6], recurring_time: "10:00", specialist_id: "first" })).toEqual([{ day: 6, time: "10:00", specialist_id: "first" }]);
    expect(validSessions([{ day: 6, time: "10:00", specialist_id: "first" }])).toBe(true);
    expect(validSessions([{ day: 6, time: "10:00", specialist_id: "first" }, { day: 6, time: "10:00", specialist_id: "second" }])).toBe(false);
  });
  test("Saturday and Tuesday retain independent times", () => {
    expect(selectedDayTimes([6, 2], { 6: "10:00", 2: "17:30" })).toEqual({ 6: "10:00", 2: "17:30" });
    expect(dayTime({ 6: "10:00", 2: "17:30" }, 2)).toBe("17:30");
  });
  test("a single selected weekday is sufficient", () => {
    expect(validDayTimes([6], { 6: "10:00" })).toBe(true);
    expect(selectedDayTimes([6], { 6: "10:00", 2: "17:30" })).toEqual({ 6: "10:00" });
    expect(validDayTimes([], {})).toBe(false);
  });
  test("existing children keep their original time", () => {
    expect(selectedDayTimes([6, 2], {}, "18:30:00")).toEqual({ 6: "18:30", 2: "18:30" });
  });
  test("selected days cannot have empty or invalid times", () => {
    expect(validDayTimes([2], { 2: "" })).toBe(false);
    expect(validDayTimes([2], { 2: "25:00" })).toBe(false);
  });
});