import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";

type Slot = {
  id: string;
  specialist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function AvailabilityEditor({ specialistId }: { specialistId: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { start: string; end: string }>>({});

  const load = async () => {
    if (!specialistId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("specialist_availability")
      .select("*")
      .eq("specialist_id", specialistId)
      .order("day_of_week")
      .order("start_time");
    if (error) toast.error(error.message);
    else setSlots((data as Slot[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [specialistId]);

  const setDraft = (dow: number, key: "start" | "end", value: string) =>
    setDrafts((d) => ({ ...d, [dow]: { ...(d[dow] || { start: "09:00", end: "12:00" }), [key]: value } }));

  const addSlot = async (dow: number) => {
    const dr = drafts[dow] || { start: "09:00", end: "12:00" };
    if (dr.end <= dr.start) return toast.error("وقت النهاية يجب أن يكون بعد البداية");
    const { error } = await (supabase as any).from("specialist_availability").insert({
      specialist_id: specialistId,
      day_of_week: dow,
      start_time: dr.start + ":00",
      end_time: dr.end + ":00",
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة الفترة");
    setDrafts((d) => ({ ...d, [dow]: { start: "09:00", end: "12:00" } }));
    load();
  };

  const removeSlot = async (id: string) => {
    const { error } = await (supabase as any).from("specialist_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSlots((s) => s.filter((x) => x.id !== id));
    toast.success("تم الحذف");
  };

  if (!specialistId) return <p className="text-sm text-muted-foreground">اختر أخصائيًا أولاً</p>;
  if (loading) return <p className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        حدد ساعات عمل الأخصائي لكل يوم. يمكن إضافة أكثر من فترة في اليوم (مثلاً صباحي ومسائي).
      </p>
      {DAY_LABELS.map((label, dow) => {
        const daySlots = slots.filter((s) => s.day_of_week === dow);
        const dr = drafts[dow] || { start: "09:00", end: "12:00" };
        return (
          <div key={dow} className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{label}</span>
              {daySlots.length === 0 && (
                <span className="text-xs text-muted-foreground">— لا توجد فترات</span>
              )}
            </div>
            <div className="space-y-1.5 mb-2">
              {daySlots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5 border">
                  <span className="text-sm font-mono" dir="ltr">
                    {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => removeSlot(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">من</Label>
                <Input type="time" value={dr.start} onChange={(e) => setDraft(dow, "start", e.target.value)} className="h-8 w-28" />
              </div>
              <div>
                <Label className="text-xs">إلى</Label>
                <Input type="time" value={dr.end} onChange={(e) => setDraft(dow, "end", e.target.value)} className="h-8 w-28" />
              </div>
              <Button size="sm" onClick={() => addSlot(dow)}>
                <Plus className="h-4 w-4" />
                إضافة فترة
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
