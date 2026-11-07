# Project architecture

- Store case weekday appointment times in `cases.recurring_times`, keyed by weekday 0–6, with `recurring_time` as a legacy fallback; this preserves deployed clients and existing schedules.
- Share `CaseWeekdayEditor` and `case-schedule` helpers across child and staff case forms; this prevents edits from silently restoring a shared time.