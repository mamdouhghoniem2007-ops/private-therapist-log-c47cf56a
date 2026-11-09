# Project architecture

- Store recurring case sessions as `cases.recurring_sessions` entries with weekday, time and specialist; NULL falls back to `recurring_times` and `recurring_time` so existing schedules remain compatible.
- Share `CaseWeekdayEditor` and `case-schedule` helpers across child and staff case forms; this prevents edits from collapsing multiple sessions into one shared time.
- Log child sessions against a selected appointment and match session rows by specialist/date/time; this keeps same-day appointments separate.