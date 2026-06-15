import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtTime12 } from "@/lib/utils";
import { Sparkles, CheckCircle2 } from "lucide-react";

const DAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

type Profile = { id: string; full_name: string };

export type Suggestion = {
  specialistId: string;
  specialistName: string;
  dayOfWeek: number;
  time: string; // HH:MM
  freeWeeks: number; // how many of the upcoming weeks are conflict-free
  weeksChecked: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialists: Profile[];
  /** Pre-selected specialist (optional). If empty → check all. */
  initialSpecialistId?: string;
  /** Pre-selected weekdays (optional). Empty = all 7. */
  initialDays?: number[];
  durationMinutes: number;
  onPick: (s: Suggestion) => void;
};

type AvailRow = { specialist_id: string; day_of_week: number; start_time: string; end_time: string };
type ApptRow = { specialist_id: string; scheduled_date: string; scheduled_time: string; duration_minutes: number };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function SlotSuggestionsDialog({
  open, onOpenChange, specialists, initialSpecialistId, initialDays, durationMinutes, onPick,
}: Props) {
  const [specialistId, setSpecialistId] = useState<string>(initialSpecialistId || "__all__");
  const [days, setDays] = useState<number[]>(initialDays && initialDays.length ? initialDays : [0, 1, 2, 3, 4, 5, 6]);
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("21:00");
  const [step, setStep] = useState(15);
  const [weeks, setWeeks] = useState(4);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSpecialistId(initialSpecialistId || "__all__");
    setDays(initialDays && initialDays.length ? initialDays : [0, 1, 2, 3, 4, 5, 6]);
    setSuggestions([]);
    setSearched(false);
  }, [open, initialSpecialistId, initialDays]);

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));

  const targetSpecialists = useMemo(() => {
    if (specialistId === "__all__") return specialists;
    return specialists.filter((s) => s.id === specialistId);
  }, [specialists, specialistId]);

  const search = async () => {
    if (days.length === 0) return toast.error("اختر يوم واحد على الأقل");
    if (targetSpecialists.length === 0) return toast.error("لا يوجد أخصائيون");
    const fromMin = toMin(fromTime);
    const toMinV = toMin(toTime);
    if (toMinV - fromMin < durationMinutes) return toast.error("النطاق أقل من مدة الجلسة");
    setLoading(true);

    const ids = targetSpecialists.map((s) => s.id);

    // load availability + upcoming appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + weeks * 7 + 1);
    const horizonStr = horizon.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const [{ data: avail }, { data: appts }] = await Promise.all([
      supabase.from("specialist_availability").select("specialist_id, day_of_week, start_time, end_time").in("specialist_id", ids),
      supabase
        .from("appointments")
        .select("specialist_id, scheduled_date, scheduled_time, duration_minutes")
        .in("specialist_id", ids)
        .gte("scheduled_date", todayStr)
        .lte("scheduled_date", horizonStr)
        .neq("status", "cancelled"),
    ]);

    const availBy = new Map<string, AvailRow[]>(); // key: spec|dow
    (avail as AvailRow[] | null)?.forEach((a) => {
      const k = `${a.specialist_id}|${a.day_of_week}`;
      const arr = availBy.get(k) || [];
      arr.push(a);
      availBy.set(k, arr);
    });

    const apptsBy = new Map<string, { start: number; end: number }[]>(); // key: spec|YYYY-MM-DD
    (appts as ApptRow[] | null)?.forEach((a) => {
      const k = `${a.specialist_id}|${a.scheduled_date}`;
      const arr = apptsBy.get(k) || [];
      const s = toMin(a.scheduled_time.slice(0, 5));
      arr.push({ start: s, end: s + (a.duration_minutes || 45) });
      apptsBy.set(k, arr);
    });

    const found: Suggestion[] = [];

    for (const spec of targetSpecialists) {
      for (const dow of days) {
        const availList = availBy.get(`${spec.id}|${dow}`) || [];
        if (availList.length === 0) continue; // specialist not available that day

        // generate candidate start times within union of [fromMin, toMin] AND availability windows
        for (let t = fromMin; t + durationMinutes <= toMinV; t += step) {
          const end = t + durationMinutes;
          const insideAvail = availList.some((w) => toMin(w.start_time.slice(0, 5)) <= t && end <= toMin(w.end_time.slice(0, 5)));
          if (!insideAvail) continue;

          // check upcoming N occurrences of this weekday
          let free = 0;
          let total = 0;
          for (let w = 0; w < weeks; w++) {
            const d = new Date(today);
            const diff = (dow - d.getDay() + 7) % 7 + w * 7;
            d.setDate(d.getDate() + diff);
            const dStr = d.toISOString().slice(0, 10);
            total++;
            const dayAppts = apptsBy.get(`${spec.id}|${dStr}`) || [];
            const conflict = dayAppts.some((a) => t < a.end && end > a.start);
            if (!conflict) free++;
          }
          if (free > 0) {
            found.push({ specialistId: spec.id, specialistName: spec.full_name, dayOfWeek: dow, time: toHHMM(t), freeWeeks: free, weeksChecked: total });
          }
        }
      }
    }

    // rank: most free weeks → earliest time → name
    found.sort((a, b) => b.freeWeeks - a.freeWeeks || toMin(a.time) - toMin(b.time) || a.specialistName.localeCompare(b.specialistName));

    setSuggestions(found.slice(0, 60));
    setSearched(true);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            اقتراح مواعيد فاضية
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الأخصائي</Label>
              <Select value={specialistId} onValueChange={setSpecialistId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">كل الأخصائيين</SelectItem>
                  {specialists.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>عدد الأسابيع للفحص</Label>
              <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8].map((n) => <SelectItem key={n} value={String(n)}>{n} أسابيع</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>من الساعة</Label>
              <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>إلى الساعة</Label>
              <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>أيام الأسبوع</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const selected = days.includes(idx);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>خطوة البحث (دقيقة)</Label>
              <Select value={String(step)} onValueChange={(v) => setStep(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مدة الجلسة</Label>
              <Input value={`${durationMinutes} دقيقة`} disabled />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={search} disabled={loading}>
              {loading ? "جارٍ التحليل..." : "ابحث عن المواعيد المتاحة"}
            </Button>
          </div>

          {searched && (
            <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  لا توجد مواعيد متاحة بالشروط المحددة. جرّب توسيع النطاق الزمني أو تغيير الأيام.
                </p>
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onPick(s); onOpenChange(false); }}
                    className="w-full text-right p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{s.specialistName}</div>
                      <div className="text-xs text-muted-foreground">
                        {DAY_LABELS[s.dayOfWeek]} · <span dir="ltr">{fmtTime12(s.time)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs rounded px-2 py-0.5 border ${s.freeWeeks === s.weeksChecked ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-amber-500/10 text-amber-700 border-amber-500/30"}`}>
                        {s.freeWeeks}/{s.weeksChecked} أسابيع متاحة
                      </span>
                      {s.freeWeeks === s.weeksChecked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
