import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, ChevronRight, ChevronLeft } from "lucide-react";
import { fmtTime12 } from "@/lib/utils";

type Profile = { id: string; full_name: string };

type Appt = {
  id: string;
  specialist_id: string;
  case_name: string;
  scheduled_date: string;
  scheduled_time: string; // HH:MM:SS
  duration_minutes: number;
  status: string;
};

type Availability = {
  specialist_id: string;
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
};

// Arabic week starts Saturday
const ARABIC_WEEK_DOW = [6, 0, 1, 2, 3, 4, 5]; // Sat, Sun, Mon, Tue, Wed, Thu, Fri
const DAY_LABEL_BY_DOW = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const startOfArabicWeek = (d: Date) => {
  // Saturday is day 6 in JS Date.getDay (Sun=0..Sat=6)
  const dow = d.getDay();
  const diff = (dow - 6 + 7) % 7; // days since Saturday
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
};

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function WeeklyScheduleGrid({
  specialists,
  profilesMap,
}: {
  specialists: Profile[];
  profilesMap: Record<string, string>;
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfArabicWeek(new Date()));
  const [specialistFilter, setSpecialistFilter] = useState<string>("all");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekStartStr = ymd(weekDates[0]);
  const weekEndStr = ymd(weekDates[6]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, avRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, specialist_id, case_name, scheduled_date, scheduled_time, duration_minutes, status")
          .gte("scheduled_date", weekStartStr)
          .lte("scheduled_date", weekEndStr)
          .neq("status", "cancelled"),
        (supabase as any).from("specialist_availability").select("*"),
      ]);
      if (!aRes.error) setAppts((aRes.data as Appt[]) || []);
      if (!avRes.error) setAvailability((avRes.data as Availability[]) || []);
      setLoading(false);
    })();
  }, [weekStartStr, weekEndStr]);

  const filtered = specialistFilter === "all"
    ? appts
    : appts.filter((a) => a.specialist_id === specialistFilter);
  const filteredAvail = specialistFilter === "all"
    ? availability
    : availability.filter((a) => a.specialist_id === specialistFilter);

  // Determine time range from availability + appointments (fallback 09:00 - 21:00)
  const { startMin, endMin } = useMemo(() => {
    let mn = 9 * 60;
    let mx = 21 * 60;
    for (const av of filteredAvail) {
      mn = Math.min(mn, toMin(av.start_time));
      mx = Math.max(mx, toMin(av.end_time));
    }
    for (const a of filtered) {
      const s = toMin(a.scheduled_time.slice(0, 5));
      mn = Math.min(mn, s);
      mx = Math.max(mx, s + (a.duration_minutes || 30));
    }
    // round to nearest 30
    mn = Math.floor(mn / 30) * 30;
    mx = Math.ceil(mx / 30) * 30;
    return { startMin: mn, endMin: mx };
  }, [filtered, filteredAvail]);

  const slots: number[] = [];
  for (let t = startMin; t < endMin; t += 30) slots.push(t);

  // Index appts by day+time slot
  const apptByCell = useMemo(() => {
    const m: Record<string, Appt[]> = {};
    for (const a of filtered) {
      const startSlot = Math.floor(toMin(a.scheduled_time.slice(0, 5)) / 30) * 30;
      const key = `${a.scheduled_date}|${startSlot}`;
      (m[key] ||= []).push(a);
    }
    return m;
  }, [filtered]);

  // For "available" highlight (only when single specialist selected)
  const isAvailable = (date: Date, slotMin: number) => {
    if (specialistFilter === "all") return false;
    const dow = date.getDay();
    return filteredAvail.some(
      (av) => av.day_of_week === dow && toMin(av.start_time) <= slotMin && slotMin < toMin(av.end_time),
    );
  };

  const goWeek = (delta: number) => setWeekStart((d) => addDays(d, delta * 7));
  const goToday = () => setWeekStart(startOfArabicWeek(new Date()));

  const statusBg = (s: string) => {
    if (s === "attended" || s === "completed") return "bg-blue-500/15 border-blue-500/40 text-blue-900";
    if (s === "apologized") return "bg-orange-500/15 border-orange-500/40 text-orange-900";
    if (s === "absent") return "bg-red-500/15 border-red-500/40 text-red-900";
    return "bg-primary/10 border-primary/30 text-foreground";
  };

  return (
    <Card className="shadow-[var(--shadow-card)] border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
          <span className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            جدول الأسبوع
            <span className="text-xs text-muted-foreground font-normal">
              {weekDates[0].toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" })} –{" "}
              {weekDates[6].toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" })}
            </span>
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={specialistFilter} onValueChange={setSpecialistFilter}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأخصائيين</SelectItem>
                {specialists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => goWeek(-1)}>
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            <Button size="sm" variant="outline" onClick={goToday}>اليوم</Button>
            <Button size="sm" variant="outline" onClick={() => goWeek(1)}>
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="border bg-muted/40 p-1 sticky right-0 z-10 w-16">الوقت</th>
                  {ARABIC_WEEK_DOW.map((dow, idx) => {
                    const d = weekDates[idx];
                    const isToday = ymd(d) === ymd(new Date());
                    return (
                      <th key={dow} className={`border p-1 ${isToday ? "bg-primary/15" : "bg-muted/40"}`}>
                        <div className="font-semibold">{DAY_LABEL_BY_DOW[dow]}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {slots.map((slotMin) => (
                  <tr key={slotMin}>
                    <td className="border bg-muted/30 p-1 text-center font-mono text-[11px] sticky right-0 z-10">
                      {fmtTime12(fromMin(slotMin))}
                    </td>
                    {ARABIC_WEEK_DOW.map((dow, idx) => {
                      const d = weekDates[idx];
                      const key = `${ymd(d)}|${slotMin}`;
                      const cellAppts = apptByCell[key] || [];
                      const avail = isAvailable(d, slotMin);
                      return (
                        <td key={dow} className={`border align-top p-0.5 h-10 ${avail && cellAppts.length === 0 ? "bg-emerald-500/5" : ""}`}>
                          {cellAppts.map((a) => (
                            <div key={a.id} className={`rounded border px-1 py-0.5 mb-0.5 leading-tight ${statusBg(a.status)}`}>
                              <div className="font-semibold truncate">{a.case_name}</div>
                              {specialistFilter === "all" && (
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {profilesMap[a.specialist_id] || "—"}
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground" dir="ltr">
                                {fmtTime12(a.scheduled_time)} · {a.duration_minutes}د
                              </div>
                            </div>
                          ))}
                          {cellAppts.length === 0 && avail && (
                            <div className="text-[10px] text-emerald-700 text-center">متاح</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {specialistFilter !== "all" && filteredAvail.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                لم يتم تحديد توافر لهذا الأخصائي بعد — يمكنك إضافته من تبويب "التوافر" في إدارة الأخصائيين.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
