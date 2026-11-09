import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAY_LABELS, type RecurringSession } from "@/lib/case-schedule";
import { fmtTime12 } from "@/lib/utils";

export function CaseWeekdayEditor({ sessions, specialists, defaultSpecialistId, onChange, idPrefix }: {
  sessions: RecurringSession[];
  specialists: { id: string; full_name: string }[];
  defaultSpecialistId: string;
  onChange: (sessions: RecurringSession[]) => void;
  idPrefix: string;
}) {
  const add = (day: number) => onChange([...sessions, { day, time: "", specialist_id: defaultSpecialistId }]);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[6, 0, 1, 2, 3, 4, 5].map((day) => {
        const rows = sessions.map((s, index) => ({ ...s, index })).filter((s) => s.day === day);
        const selected = rows.length > 0;
        const id = `${idPrefix}-${day}`;
        return (
          <div key={day} className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id={id} checked={selected} onCheckedChange={(checked) => checked ? add(day) : onChange(sessions.filter((s) => s.day !== day))} />
              <Label htmlFor={id}>{WEEKDAY_LABELS[day]}</Label>
            </div>
            {selected && (
              <div className="space-y-3 border-s border-border ps-3">
                {rows.map((row, number) => (
                  <div key={row.index} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">جلسة {number + 1}</span>
                      <Button type="button" size="icon" variant="ghost" aria-label={`حذف جلسة ${WEEKDAY_LABELS[day]} ${number + 1}`} title="حذف الجلسة" onClick={() => onChange(sessions.filter((_, i) => i !== row.index))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <Input type="time" aria-label={`ساعة ${WEEKDAY_LABELS[day]} ${number + 1}`} required value={row.time} onChange={(e) => onChange(sessions.map((s, i) => i === row.index ? { ...s, time: e.target.value } : s))} dir="ltr" className="w-full min-w-0" />
                    <Select value={row.specialist_id} onValueChange={(value) => onChange(sessions.map((s, i) => i === row.index ? { ...s, specialist_id: value } : s))}>
                      <SelectTrigger aria-label={`أخصائي ${WEEKDAY_LABELS[day]} ${number + 1}`} className="w-full min-w-0"><SelectValue placeholder="اختر الأخصائي" /></SelectTrigger>
                      <SelectContent>{specialists.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground" dir="ltr">{row.time ? fmtTime12(row.time) : "—"}</p>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => add(day)} aria-label={`إضافة جلسة ${WEEKDAY_LABELS[day]}`}><Plus className="h-4 w-4" />جلسة أخرى</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}