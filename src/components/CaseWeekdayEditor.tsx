import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayTime, WEEKDAY_LABELS, type DayTimes } from "@/lib/case-schedule";
import { fmtTime12 } from "@/lib/utils";

export function CaseWeekdayEditor({ days, times, fallbackTime = "16:00", onChange, idPrefix }: {
  days: number[];
  times: unknown;
  fallbackTime?: string;
  onChange: (days: number[], times: DayTimes) => void;
  idPrefix: string;
}) {
  const current = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [String(day), dayTime(times, day, fallbackTime)]));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {[6, 0, 1, 2, 3, 4, 5].map((day) => {
        const selected = days.includes(day);
        const id = `${idPrefix}-${day}`;
        return (
          <div key={day} className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id={id} checked={selected} onCheckedChange={(checked) => onChange(checked ? [...days, day].sort() : days.filter((d) => d !== day), current)} />
              <Label htmlFor={id}>{WEEKDAY_LABELS[day]}</Label>
            </div>
            {selected && (
              <div className="space-y-1">
                <Input type="time" aria-label={`ساعة ${WEEKDAY_LABELS[day]}`} required value={current[String(day)]} onChange={(e) => onChange(days, { ...current, [String(day)]: e.target.value })} dir="ltr" className="w-full min-w-0" />
                <p className="text-xs text-muted-foreground" dir="ltr">{current[String(day)] ? fmtTime12(current[String(day)]) : "—"}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}