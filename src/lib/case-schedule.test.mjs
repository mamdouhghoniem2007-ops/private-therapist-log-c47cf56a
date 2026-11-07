import { describe, expect, test } from "bun:test";
import { dayTime, selectedDayTimes, validDayTimes } from "./case-schedule";

describe("child weekday appointment times", () => {
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