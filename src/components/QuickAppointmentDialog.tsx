import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Profile = { id: string; full_name: string };

type CaseRow = {
  id: string;
  name: string;
  whatsapp: string | null;
  specialist_id: string;
  default_cost: number;
  default_specialist_percentage: number;
  default_duration_minutes: number;
  discount_percentage: number;
  payment_type: string;
  active: boolean;
};

export type AppointmentLite = {
  id: string;
  specialist_id: string;
  case_id: string | null;
  case_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  cost: number | null;
  specialist_percentage: number;
  discount_percentage: number;
  payment_type: string;
  status: string;
  notes: string | null;
  case_whatsapp: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialists: Profile[];
  canSeeFinancial: boolean;
  currentUserId: string;
  onSaved: () => void;
  /** When provided → edit mode. When omitted → add mode. */
  appointment?: AppointmentLite | null;
  /** Pre-fill for add mode */
  preset?: { date?: string; time?: string; specialistId?: string };
  /** If true and add mode: status = attended + write to sessions. */
  attendedByDefault?: boolean;
};

export function QuickAppointmentDialog({
  open, onOpenChange, specialists, canSeeFinancial, currentUserId,
  onSaved, appointment, preset, attendedByDefault,
}: Props) {
  const isEdit = !!appointment;
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [specialistId, setSpecialistId] = useState<string>("");
  const [caseId, setCaseId] = useState<string>("");
  const [caseName, setCaseName] = useState<string>("");
  const [caseWhatsapp, setCaseWhatsapp] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(45);
  const [cost, setCost] = useState<string>("");
  const [percentage, setPercentage] = useState<number>(50);
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<string>("scheduled");
  const [saving, setSaving] = useState(false);

  // Load cases on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("cases")
        .select("id, name, whatsapp, specialist_id, default_cost, default_specialist_percentage, default_duration_minutes, discount_percentage, payment_type, active")
        .eq("active", true)
        .order("name");
      setCases((data as CaseRow[]) || []);
      setLoading(false);
    })();
  }, [open]);

  // Initialize fields when dialog opens
  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setSpecialistId(appointment.specialist_id);
      setCaseId(appointment.case_id || "");
      setCaseName(appointment.case_name);
      setCaseWhatsapp(appointment.case_whatsapp || "");
      setDate(appointment.scheduled_date);
      setTime(appointment.scheduled_time.slice(0, 5));
      setDuration(appointment.duration_minutes);
      setCost(appointment.cost != null ? String(appointment.cost) : "");
      setPercentage(Number(appointment.specialist_percentage) || 50);
      setNotes(appointment.notes || "");
      setStatus(appointment.status);
    } else {
      setSpecialistId(preset?.specialistId || "");
      setCaseId("");
      setCaseName("");
      setCaseWhatsapp("");
      setDate(preset?.date || new Date().toISOString().slice(0, 10));
      setTime(preset?.time || new Date().toTimeString().slice(0, 5));
      setDuration(45);
      setCost("");
      setPercentage(50);
      setNotes("");
      setStatus(attendedByDefault ? "attended" : "scheduled");
    }
  }, [open, appointment, preset, attendedByDefault]);

  // Cases filtered by selected specialist (or all if none chosen)
  const filteredCases = useMemo(
    () => (specialistId ? cases.filter((c) => c.specialist_id === specialistId) : cases),
    [cases, specialistId],
  );

  // When case picked → pre-fill specialist + defaults
  const pickCase = (id: string) => {
    setCaseId(id);
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    setCaseName(c.name);
    if (!specialistId) setSpecialistId(c.specialist_id);
    setDuration(c.default_duration_minutes || 45);
    setPercentage(Number(c.default_specialist_percentage) || 50);
    if (canSeeFinancial) setCost(String(c.default_cost ?? ""));
  };

  const save = async () => {
    if (!specialistId) return toast.error("اختر الأخصائي");
    if (!caseId && !caseName.trim()) return toast.error("اختر الحالة");
    if (!date || !time) return toast.error("أدخل التاريخ والوقت");
    setSaving(true);

    const c = cases.find((x) => x.id === caseId);
    const payload: any = {
      specialist_id: specialistId,
      case_id: caseId || null,
      case_name: (caseName || c?.name || "").trim(),
      case_whatsapp: c?.whatsapp || null,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: duration,
      specialist_percentage: percentage,
      discount_percentage: c ? Number(c.discount_percentage) || 0 : 0,
      payment_type: c?.payment_type || "per_session",
      session_kind: "regular",
      status,
      notes: notes.trim() || null,
    };
    if (canSeeFinancial) {
      payload.cost = cost === "" ? (c?.default_cost ?? 0) : Number(cost);
    } else {
      payload.cost = c?.default_cost ?? 0;
    }

    if (isEdit && appointment) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", appointment.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("تم تعديل الموعد");
      onSaved();
      onOpenChange(false);
      return;
    }

    payload.created_by = currentUserId;
    if (status === "attended") {
      const nowIso = new Date().toISOString();
      payload.started_at = nowIso;
      payload.ended_at = nowIso;
    }

    const { data: inserted, error } = await supabase.from("appointments").insert(payload).select().single();
    if (error) { setSaving(false); return toast.error(error.message); }

    if (status === "attended" && inserted) {
      await supabase.from("sessions").insert({
        specialist_id: payload.specialist_id,
        case_name: payload.case_name,
        session_date: payload.scheduled_date,
        session_time: payload.scheduled_time,
        duration_minutes: payload.duration_minutes,
        cost: payload.cost,
        specialist_percentage: payload.specialist_percentage,
        discount_percentage: payload.discount_percentage,
        payment_type: payload.payment_type,
        session_type: null,
        test_type: null,
        notes: payload.notes,
      });
    }
    setSaving(false);
    toast.success(status === "attended" ? "تم تسجيل الجلسة ✅" : "تم إضافة الموعد للجدول");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الموعد" : (attendedByDefault ? "تسجيل جلسة طارئة" : "إضافة موعد")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>الأخصائي</Label>
            <Select value={specialistId} onValueChange={(v) => { setSpecialistId(v); setCaseId(""); }}>
              <SelectTrigger><SelectValue placeholder="اختر الأخصائي" /></SelectTrigger>
              <SelectContent>
                {specialists.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>الحالة {loading && <span className="text-xs text-muted-foreground">(جارٍ التحميل...)</span>}</Label>
            <Select value={caseId || "__new__"} onValueChange={(v) => { if (v === "__new__") { setCaseId(""); } else { pickCase(v); } }}>
              <SelectTrigger><SelectValue placeholder="اختر الحالة أو اسم جديد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">➕ اسم جديد (غير مسجّل)</SelectItem>
                {filteredCases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                {filteredCases.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">لا توجد حالات نشطة لهذا الأخصائي</div>
                )}
              </SelectContent>
            </Select>
            {!caseId && (
              <Input
                placeholder="اكتب اسم الحالة الجديدة"
                value={caseName}
                onChange={(e) => setCaseName(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>الوقت</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المدة (دقيقة)</Label>
              <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 45)} />
            </div>
            {canSeeFinancial && (
              <div className="space-y-1.5">
                <Label>السعر</Label>
                <Input type="number" min={0} step="0.5" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="من الحالة" />
              </div>
            )}
            {canSeeFinancial && (
              <div className="space-y-1.5">
                <Label>نسبة الأخصائي %</Label>
                <Input type="number" min={0} max={100} value={percentage} onChange={(e) => setPercentage(Number(e.target.value) || 0)} />
              </div>
            )}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">مجدول</SelectItem>
                    <SelectItem value="attended">تم الحضور</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
