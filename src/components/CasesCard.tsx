import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Trash2, RefreshCw, Calendar, ChevronDown, ChevronUp, MessageCircle, Pencil, X, Save, FileText, PlayCircle } from "lucide-react";
import { waLink, formatAppointmentMessage } from "@/lib/whatsapp";
import { fmtTime12 } from "@/lib/utils";

type CaseAppt = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  session_kind: string;
};

const KIND_LABEL: Record<string, string> = {
  regular: "جلسة عادية",
  assessment: "تقييم",
  test: "اختبار",
  // legacy
  initial_assessment: "تقييم مبدئي",
  periodic_assessment: "تقييم دوري",
};

type Role = "admin" | "supervisor" | "specialist";

type CaseRow = {
  id: string;
  name: string;
  whatsapp: string | null;
  specialist_id: string;
  recurring_days: number[];
  recurring_time: string;
  default_duration_minutes: number;
  default_cost: number;
  default_specialist_percentage: number;
  default_session_kind: string;
  default_session_subtype: string | null;
  start_date: string;
  active: boolean;
  notes: string | null;
  payment_type: string;
  discount_percentage: number;
};

const PAYMENT_TYPE_OPTIONS = [
  { value: "per_session", label: "بالجلسة" },
  { value: "monthly", label: "بالشهر" },
];
const PAYMENT_TYPE_LABEL: Record<string, string> = {
  per_session: "بالجلسة",
  monthly: "بالشهر",
};

const DAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const DURATION_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
const PERCENTAGE_OPTIONS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const COST_PRESETS = [30, 75, 87.5, 100];
const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "regular", label: "جلسة عادية" },
  { value: "assessment", label: "تقييم" },
  { value: "test", label: "اختبار" },
];
const REGULAR_SUBTYPES = ["تخاطب", "تنمية مهارات", "تعديل سلوك", "تأهيل", "تأسيس أكاديمي", "صعوبات تعلم", "علاج وظيفي"];
const ASSESSMENT_SUBTYPES = ["تقييم مبدئي", "تقييم دوري"];
const TEST_SUBTYPES = [
  "IQ ستانفورد بينيه",
  "وكسلر للأطفال",
  "ADHD - فرط الحركة وتشتت الانتباه",
  "مقياس فرص الانتباه (Conners)",
  "مقياس جيليام للتوحد (GARS)",
  "بورتاج للنمو",
  "فاينلاند للسلوك التكيفي",
  "اختبار اللغة",
  "اختبار صعوبات التعلم",
  "تقييم النطق والكلام",
];
const subtypeOptions = (kind: string) =>
  kind === "test" ? TEST_SUBTYPES : kind === "assessment" ? ASSESSMENT_SUBTYPES : REGULAR_SUBTYPES;
const defaultSubtypeFor = (kind: string) => subtypeOptions(kind)[0];
const today = () => new Date().toISOString().slice(0, 10);



export function CasesCard({
  user, role, specialists, profilesMap,
}: {
  user: User;
  role: Role;
  specialists: { id: string; full_name: string }[];
  profilesMap: Record<string, string>;
}) {
  const canManage = role === "admin" || role === "supervisor";
  const isSupervisor = role === "supervisor";
  const canSeeFinancial = !isSupervisor;
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [appts, setAppts] = useState<Record<string, CaseAppt[]>>({});
  const [apptLoading, setApptLoading] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CaseRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (c: CaseRow) => {
    setEditingId(c.id);
    setEditDraft({ ...c });
  };
  const editCostPresetValue = (draft: CaseRow | null) => {
    if (!draft) return "";
    return COST_PRESETS.includes(Number(draft.default_cost)) ? String(draft.default_cost) : "custom";
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const toggleEditDay = (d: number) => {
    if (!editDraft) return;
    const ds = editDraft.recurring_days.includes(d)
      ? editDraft.recurring_days.filter((x) => x !== d)
      : [...editDraft.recurring_days, d].sort();
    setEditDraft({ ...editDraft, recurring_days: ds });
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) return toast.error("اسم الحالة مطلوب");
    if (editDraft.recurring_days.length === 0) return toast.error("اختر أيام الأسبوع");
    setSavingEdit(true);
    const { error } = await supabase.from("cases").update({
      name: editDraft.name.trim(),
      whatsapp: editDraft.whatsapp?.trim() || null,
      specialist_id: editDraft.specialist_id,
      recurring_days: editDraft.recurring_days,
      recurring_time: editDraft.recurring_time,
      default_duration_minutes: editDraft.default_duration_minutes,
      default_cost: Number(editDraft.default_cost),
      default_specialist_percentage: editDraft.default_specialist_percentage,
      default_session_kind: editDraft.default_session_kind,
      default_session_subtype: editDraft.default_session_subtype,
      payment_type: editDraft.payment_type || "per_session",
      discount_percentage: Number(editDraft.discount_percentage) || 0,
      start_date: editDraft.start_date,
      notes: editDraft.notes,
    }).eq("id", editDraft.id);
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((x) => x.id === editDraft.id ? editDraft : x));
    setAppts((a) => { const { [editDraft.id]: _, ...rest } = a; return rest; });
    toast.success("تم حفظ التعديلات");
    cancelEdit();
  };



  const toggleExpand = async (c: CaseRow) => {
    const isOpen = !!expanded[c.id];
    setExpanded((e) => ({ ...e, [c.id]: !isOpen }));
    if (!isOpen && !appts[c.id]) {
      setApptLoading((l) => ({ ...l, [c.id]: true }));
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_date, scheduled_time, status, session_kind")
        .eq("case_id", c.id)
        .gte("scheduled_date", today())
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
        .limit(50);
      if (error) toast.error(error.message);
      setAppts((a) => ({ ...a, [c.id]: (data as CaseAppt[]) || [] }));
      setApptLoading((l) => ({ ...l, [c.id]: false }));
    }
  };

  const markCaseAbsentToday = async (c: CaseRow) => {
    const todayStr = today();
    const { data: existing, error: qErr } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("case_id", c.id)
      .eq("scheduled_date", todayStr)
      .order("scheduled_time", { ascending: true })
      .limit(1);
    if (qErr) { toast.error(qErr.message); return; }
    const row = existing?.[0];
    if (!row) {
      toast.error("لا يوجد موعد لهذه الحالة اليوم");
      return;
    }
    const { error } = await supabase
      .from("appointments")
      .update({ status: "absent", started_at: null, ended_at: null })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setAppts((a) => {
      const list = a[c.id];
      if (!list) return a;
      return { ...a, [c.id]: list.map((x) => x.id === row.id ? { ...x, status: "absent" } : x) };
    });
    toast.success("تم تسجيل غياب الحالة اليوم 🔴");
  };

  const openCaseLog = async (c: CaseRow) => {
    const todayStr = today();
    // اجلب كل الجلسات السابقة للحالة حتى تاريخ اليوم (تراكمي)
    const { data: sData, error: sErr } = await supabase
      .from("sessions")
      .select("session_date, session_time, duration_minutes, session_type, test_type, notes, specialist_id")
      .ilike("case_name", c.name)
      .lte("session_date", todayStr)
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true });
    if (sErr) { toast.error(sErr.message); return; }

    // اجلب أيضًا المواعيد التي تم اعتذارها/غيابها لإظهارها في السجل
    const { data: aData } = await supabase
      .from("appointments")
      .select("scheduled_date, scheduled_time, duration_minutes, session_kind, status, notes, specialist_id")
      .eq("case_id", c.id)
      .in("status", ["apologized", "cancelled", "absent"])
      .lte("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: true });

    type Row = {
      date: string; time: string; duration: number;
      kind: string; status: string; notes: string; specialistId: string;
    };
    const rows: Row[] = [
      ...((sData as any[]) || []).map((s) => ({
        date: s.session_date,
        time: s.session_time,
        duration: s.duration_minutes,
        kind: s.test_type || s.session_type || "جلسة",
        status: "تمت",
        notes: s.notes || "",
        specialistId: s.specialist_id,
      })),
      ...((aData as any[]) || []).map((a) => ({
        date: a.scheduled_date,
        time: a.scheduled_time,
        duration: a.duration_minutes,
        kind: KIND_LABEL[a.session_kind] || a.session_kind,
        status: a.status === "absent" ? "غياب" : "اعتذار",
        notes: a.notes || "",
        specialistId: a.specialist_id,
      })),
    ].sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));

    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["التاريخ", "الوقت", "المدة (د)", "النوع", "الحالة", "الأخصائي", "ما تم خلال الجلسة"];
    const csvRows = rows.map((r) => [
      r.date,
      fmtTime12(r.time),
      r.duration,
      r.kind,
      r.status,
      profilesMap[r.specialistId] || "—",
      r.notes.replace(/\n/g, " "),
    ].map(esc).join(","));
    const csv = "\uFEFF" + [headers.map(esc).join(","), ...csvRows].join("\n");
    const csvDataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const fileName = `سجل-${c.name}-${todayStr}.csv`;

    const bodyRows = rows.map((r) => `
      <tr class="${r.status === "تمت" ? "" : "row-skip"}">
        <td>${r.date}</td>
        <td>${fmtTime12(r.time)}</td>
        <td>${r.duration}</td>
        <td>${r.kind}</td>
        <td>${r.status}</td>
        <td>${profilesMap[r.specialistId] || "—"}</td>
        <td class="notes">${(r.notes || "").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</td>
      </tr>`).join("");

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>السجل التراكمي - ${c.name}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:22px;color:#111}
      h1{margin:0 0 4px;font-size:20px}
      .meta{color:#555;font-size:12px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #999;padding:6px 7px;text-align:center;vertical-align:top}
      td.notes{text-align:right;max-width:380px;white-space:pre-wrap}
      thead{background:#f0f0f0}
      .row-skip{background:#fff5f0;color:#7a3a00}
      .toolbar{margin:0 0 14px;display:flex;gap:10px;flex-wrap:wrap}
      .toolbar a,.toolbar button{padding:8px 14px;font-size:13px;border:1px solid #888;border-radius:6px;background:#fafafa;cursor:pointer;text-decoration:none;color:#111}
      @media print { .noprint{display:none} body{padding:10px} }
    </style></head><body>
    <h1>السجل التراكمي للحالة: ${c.name}</h1>
    <div class="meta">
      الأخصائي: ${profilesMap[c.specialist_id] || "—"} ·
      عدد القيود: ${rows.length} ·
      تاريخ الاطلاع: ${new Date().toLocaleString("ar-EG")}
    </div>
    <div class="toolbar noprint">
      <button onclick="window.print()">طباعة</button>
      <a href="${csvDataUri}" download="${fileName}">تنزيل Excel/CSV</a>
    </div>
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${headers.length}">لا توجد جلسات سابقة</td></tr>`}</tbody>
    </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error("فشل فتح نافذة السجل — تأكد من السماح بالنوافذ المنبثقة"); return; }
    w.document.write(html);
    w.document.close();
  };


  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [specialistId, setSpecialistId] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState("16:00");
  const [duration, setDuration] = useState(45);
  const [cost, setCost] = useState<number | "">("");
  const [costSelect, setCostSelect] = useState<string>("");
  const [percentage, setPercentage] = useState(50);
  const [sessionKind, setSessionKind] = useState<string>("regular");
  const [sessionSubtype, setSessionSubtype] = useState<string>(defaultSubtypeFor("regular"));
  const [startDate, setStartDate] = useState(today());
  const [paymentType, setPaymentType] = useState<string>("per_session");
  const [discountPct, setDiscountPct] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);

  // Quick-log session dialog
  const [logCase, setLogCase] = useState<CaseRow | null>(null);
  const [logNotes, setLogNotes] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);

  const openQuickLog = (c: CaseRow) => {
    setLogCase(c);
    setLogNotes("");
  };
  const closeQuickLog = () => {
    setLogCase(null);
    setLogNotes("");
  };
  const submitQuickLog = async () => {
    if (!logCase) return;
    setLogSubmitting(true);
    const todayStr = today();
    const nowTime = new Date().toTimeString().slice(0, 5);
    const notes = logNotes.trim() || null;

    // Check if there's already an appointment for this case today → merge
    const { data: existingAppt } = await supabase
      .from("appointments")
      .select("id, notes, status")
      .eq("case_id", logCase.id)
      .eq("scheduled_date", todayStr)
      .order("scheduled_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (existingAppt) {
      const merged = notes
        ? ((existingAppt as any).notes ? `${(existingAppt as any).notes}\n${notes}` : notes)
        : (existingAppt as any).notes;
      await supabase.from("appointments")
        .update({ notes: merged, status: "attended", started_at: nowIso, ended_at: nowIso })
        .eq("id", (existingAppt as any).id);
      // Ensure session row exists / update notes
      const { data: existSess } = await supabase
        .from("sessions").select("id")
        .eq("specialist_id", logCase.specialist_id)
        .eq("case_name", logCase.name)
        .eq("session_date", todayStr)
        .maybeSingle();
      if (existSess) {
        await supabase.from("sessions").update({ notes: merged }).eq("id", (existSess as any).id);
      } else {
        await supabase.from("sessions").insert({
          specialist_id: logCase.specialist_id,
          case_name: logCase.name,
          session_date: todayStr,
          session_time: nowTime,
          duration_minutes: logCase.default_duration_minutes,
          cost: Number(logCase.default_cost) || 0,
          specialist_percentage: Number(logCase.default_specialist_percentage) || 50,
          discount_percentage: Number(logCase.discount_percentage) || 0,
          payment_type: logCase.payment_type || "per_session",
          session_type: null,
          test_type: null,
          notes: merged,
        });
      }
    } else {
      const { error } = await supabase.from("appointments").insert({
        specialist_id: logCase.specialist_id,
        case_name: logCase.name,
        case_id: logCase.id,
        scheduled_date: todayStr,
        scheduled_time: nowTime,
        duration_minutes: logCase.default_duration_minutes,
        cost: Number(logCase.default_cost) || 0,
        specialist_percentage: Number(logCase.default_specialist_percentage) || 50,
        discount_percentage: Number(logCase.discount_percentage) || 0,
        payment_type: logCase.payment_type || "per_session",
        session_kind: "regular",
        session_type: null,
        test_type: null,
        status: "attended",
        started_at: nowIso,
        ended_at: nowIso,
        notes,
        created_by: user.id,
      });
      if (error) { setLogSubmitting(false); return toast.error(error.message); }
      await supabase.from("sessions").insert({
        specialist_id: logCase.specialist_id,
        case_name: logCase.name,
        session_date: todayStr,
        session_time: nowTime,
        duration_minutes: logCase.default_duration_minutes,
        cost: Number(logCase.default_cost) || 0,
        specialist_percentage: Number(logCase.default_specialist_percentage) || 50,
        discount_percentage: Number(logCase.discount_percentage) || 0,
        payment_type: logCase.payment_type || "per_session",
        session_type: null,
        test_type: null,
        notes,
      });
    }
    setLogSubmitting(false);
    toast.success(`تم تسجيل جلسة الحالة "${logCase.name}" ✅`);
    closeQuickLog();
  };



  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cases").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCases((data as CaseRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!specialistId && specialists.length) setSpecialistId(specialists[0].id);
  }, [specialists, specialistId]);

  const toggleDay = (d: number) =>
    setDays((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort());
  const resetForm = () => {
    setName(""); setWhatsapp(""); setDays([]); setCost(""); setCostSelect("");
    setSessionKind("regular"); setSessionSubtype(defaultSubtypeFor("regular"));
    setPaymentType("per_session"); setDiscountPct("");
    setShowForm(false);
  };



  const addCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialistId) return toast.error("اختر الأخصائي");
    if (days.length === 0) return toast.error("اختر أيام الأسبوع");
    if (canSeeFinancial && (cost === "" || cost < 0)) return toast.error("أدخل سعر الجلسة");
    const disc = !canSeeFinancial ? 0 : (discountPct === "" ? 0 : Number(discountPct));
    if (canSeeFinancial && (disc < 0 || disc > 100)) return toast.error("نسبة الخصم بين 0 و 100");
    setSubmitting(true);
    const { error } = await supabase.from("cases").insert({
      name: name.trim(),
      whatsapp: whatsapp.trim() || null,
      specialist_id: specialistId,
      recurring_days: days,
      recurring_time: time,
      default_duration_minutes: duration,
      default_cost: canSeeFinancial ? Number(cost) : 0,
      default_specialist_percentage: canSeeFinancial ? percentage : 0,
      default_session_kind: sessionKind,
      default_session_subtype: sessionSubtype,
      payment_type: canSeeFinancial ? paymentType : "per_session",
      discount_percentage: disc,
      start_date: startDate,
      active: true,
      created_by: user.id,
    });

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة الحالة وتوليد المواعيد القادمة");
    resetForm();
    load();
  };

  const toggleActive = async (c: CaseRow) => {
    const { error } = await supabase.from("cases").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((x) => x.id === c.id ? { ...x, active: !c.active } : x));
    toast.success(!c.active ? "تم تفعيل الحالة" : "تم إيقاف الحالة");
  };

  const regenerate = async (c: CaseRow) => {
    const until = new Date();
    until.setDate(until.getDate() + 56);
    const { data, error } = await supabase.rpc("generate_case_appointments", {
      _case_id: c.id,
      _until: until.toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success(`تم توليد ${data ?? 0} موعد جديد`);
  };

  const remove = async (c: CaseRow) => {
    if (!confirm(`حذف الحالة "${c.name}"؟ المواعيد المستقبلية المرتبطة بها ستُحذف.`)) return;
    // delete future appointments first
    await supabase.from("appointments")
      .delete()
      .eq("case_id", c.id)
      .gte("scheduled_date", today());
    const { error } = await supabase.from("cases").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.filter((x) => x.id !== c.id));
    toast.success("تم حذف الحالة");
  };

  const visibleCases = useMemo(() => {
    if (canManage) return cases;
    return cases.filter((c) => c.specialist_id === user.id);
  }, [cases, canManage, user.id]);

  return (
    <Card className="shadow-[var(--shadow-card)] border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            ملف الحالات
            <span className="text-xs text-muted-foreground font-normal">({visibleCases.length})</span>
          </span>
          {canManage && (
            <Button size="sm" variant={showForm ? "secondary" : "default"} onClick={() => setShowForm((s) => !s)}>
              <Plus className="h-4 w-4 ml-1" />
              {showForm ? "إغلاق" : "إضافة حالة"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && showForm && (
          <form onSubmit={addCase} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1.5">
              <Label>اسم الحالة</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد م." />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" placeholder="+201234567890" />
            </div>
            <div className="space-y-1.5">
              <Label>الأخصائي</Label>
              <Select value={specialistId} onValueChange={setSpecialistId}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  {specialists.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ البدء</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <Label>أيام الأسبوع المتكررة</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const selected = days.includes(idx);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-input"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الساعة</Label>
              <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المدة</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(+v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} دقيقة</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canSeeFinancial && (
            <div className="space-y-1.5">
              <Label>سعر الجلسة</Label>
              <Select
                value={costSelect}
                onValueChange={(v) => {
                  setCostSelect(v);
                  if (v !== "custom") setCost(Number(v));
                  else setCost("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر السعر..." /></SelectTrigger>
                <SelectContent>
                  {COST_PRESETS.map((c) => (
                    <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                  ))}
                  <SelectItem value="custom">قيمة أخرى</SelectItem>
                </SelectContent>
              </Select>
              {costSelect === "custom" && (
                <Input
                  type="number" min={0} step="0.01" required
                  value={cost}
                  onChange={(e) => setCost(e.target.value === "" ? "" : +e.target.value)}
                  placeholder="اكتب السعر"
                />
              )}
            </div>
            )}
            {canSeeFinancial && (
            <div className="space-y-1.5">
              <Label>نسبة الأخصائي %</Label>
              <Input
                type="number" min={0} max={100} step="0.01" required
                value={percentage}
                onChange={(e) => setPercentage(e.target.value === "" ? 0 : +e.target.value)}
                placeholder="مثال: 12.5"
              />
            </div>
            )}
            <div className="space-y-1.5">
              <Label>نوع الجلسة</Label>
              <Select value={sessionKind} onValueChange={(v) => { setSessionKind(v); setSessionSubtype(defaultSubtypeFor(v)); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{sessionKind === "test" ? "نوع الاختبار" : sessionKind === "assessment" ? "نوع التقييم" : "تخصص الجلسة"}</Label>
              <Select value={sessionSubtype} onValueChange={setSessionSubtype}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subtypeOptions(sessionKind).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canSeeFinancial && (
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            )}
            {canSeeFinancial && (
            <div className="space-y-1.5">
              <Label>نسبة الخصم %</Label>
              <Input
                type="number" min={0} max={100} step="0.01" inputMode="decimal"
                value={discountPct as any}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setDiscountPct("");
                  setDiscountPct(v as any);
                }}
                placeholder="مثال: 12.5"
              />
            </div>
            )}


            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "جارٍ الحفظ..." : "إضافة الحالة وتوليد المواعيد"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : visibleCases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد حالات مسجَّلة</p>
        ) : (
          <div className="divide-y">
            {visibleCases.map((c) => (
              <div key={c.id} className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${!c.active ? "text-muted-foreground line-through" : ""}`}>{c.name}</span>
                      {!c.active && <span className="text-xs rounded bg-muted px-2 py-0.5">موقوفة</span>}
                      <span className="text-xs text-muted-foreground">— {profilesMap[c.specialist_id] || "—"}</span>
                      <span className="text-[10px] rounded bg-primary/10 text-primary px-1.5 py-0.5">
                        {KIND_OPTIONS.find((k) => k.value === (c.default_session_kind || "regular"))?.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.recurring_days.map((d) => DAY_LABELS[d]).join("، ") || "—"}
                      <span dir="ltr"> · {fmtTime12(c.recurring_time)}</span>
                      {" · "}{c.default_duration_minutes} د
                      {" · "}{Number(c.default_cost).toFixed(2)} ({c.default_specialist_percentage}%)
                      {" · "}{PAYMENT_TYPE_LABEL[c.payment_type] || "بالجلسة"}
                      {Number(c.discount_percentage) > 0 && (
                        <span className="text-amber-700"> · خصم {Number(c.discount_percentage)}%</span>
                      )}
                      {c.whatsapp && <span dir="ltr"> · {c.whatsapp}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => toggleExpand(c)}>
                      <Calendar className="h-4 w-4 ml-1" />
                      المواعيد
                      {expanded[c.id] ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openCaseLog(c)} title="السجل التراكمي لكل الجلسات السابقة">
                      <FileText className="h-4 w-4 ml-1" />
                      السجل
                    </Button>
                    {c.active && (canManage || c.specialist_id === user.id) && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => openQuickLog(c)}
                        title="تسجيل جلسة الآن لهذه الحالة"
                      >
                        <PlayCircle className="h-4 w-4 ml-1" />
                        تسجيل جلسة
                      </Button>
                    )}
                    {role === "specialist" && c.specialist_id === user.id && c.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/50 text-red-700 hover:bg-red-500/10"
                        onClick={() => markCaseAbsentToday(c)}
                      >
                        غائبة اليوم
                      </Button>
                    )}
                    {canManage && c.whatsapp && (() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const next = (appts[c.id] || []).find((a) => a.scheduled_date >= todayStr && a.status !== "cancelled");
                      const msg = next
                        ? formatAppointmentMessage({
                            caseName: c.name,
                            date: next.scheduled_date,
                            time: next.scheduled_time,
                            durationMinutes: c.default_duration_minutes,
                            specialistName: profilesMap[c.specialist_id] || null,
                            sessionKindLabel: next.session_kind !== "regular" ? KIND_LABEL[next.session_kind] : null,
                          })
                        : `السلام عليكم، بخصوص جلسات "${c.name}" — مركز رعاية.`;
                      const link = waLink(c.whatsapp, msg);
                      return link ? (
                        <Button asChild size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10">
                          <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => { if (!appts[c.id]) toggleExpand(c); }}>
                            <MessageCircle className="h-4 w-4 ml-1" />
                            واتساب
                          </a>
                        </Button>
                      ) : null;
                    })()}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => regenerate(c)} title="توليد مواعيد 8 أسابيع قادمة">
                          <RefreshCw className="h-4 w-4 ml-1" />
                          توليد
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                          {c.active ? "إيقاف" : "تفعيل"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => editingId === c.id ? cancelEdit() : startEdit(c)}>
                          {editingId === c.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {canManage && editingId === c.id && editDraft && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-1.5">
                      <Label>اسم الحالة</Label>
                      <Input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>WhatsApp</Label>
                      <Input dir="ltr" value={editDraft.whatsapp ?? ""} onChange={(e) => setEditDraft({ ...editDraft, whatsapp: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>الأخصائي</Label>
                      <Select value={editDraft.specialist_id} onValueChange={(v) => setEditDraft({ ...editDraft, specialist_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {specialists.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>تاريخ البدء</Label>
                      <Input type="date" value={editDraft.start_date} onChange={(e) => setEditDraft({ ...editDraft, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                      <Label>أيام الأسبوع</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAY_LABELS.map((label, idx) => {
                          const selected = editDraft.recurring_days.includes(idx);
                          return (
                            <button type="button" key={idx} onClick={() => toggleEditDay(idx)}
                              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                                selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"
                              }`}>{label}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>الساعة</Label>
                      <Input type="time" value={editDraft.recurring_time.slice(0,5)} onChange={(e) => setEditDraft({ ...editDraft, recurring_time: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>المدة</Label>
                      <Select value={String(editDraft.default_duration_minutes)} onValueChange={(v) => setEditDraft({ ...editDraft, default_duration_minutes: +v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} دقيقة</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>سعر الجلسة</Label>
                      <Select
                        value={editCostPresetValue(editDraft)}
                        onValueChange={(v) => {
                          if (v !== "custom") setEditDraft({ ...editDraft, default_cost: Number(v) });
                          else setEditDraft({ ...editDraft, default_cost: 0 });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COST_PRESETS.map((c) => (
                            <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                          ))}
                          <SelectItem value="custom">قيمة أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                      {editCostPresetValue(editDraft) === "custom" && (
                        <Input
                          type="number" min={0} step="0.01"
                          value={editDraft.default_cost || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, default_cost: e.target.value === "" ? 0 : +e.target.value })}
                          placeholder="اكتب السعر"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>نسبة الأخصائي %</Label>
                      <Input
                        type="number" min={0} max={100} step="0.01"
                        value={editDraft.default_specialist_percentage ?? 0}
                        onChange={(e) => setEditDraft({ ...editDraft, default_specialist_percentage: e.target.value === "" ? 0 : +e.target.value })}
                        placeholder="مثال: 12.5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>نوع الجلسة</Label>
                      <Select value={editDraft.default_session_kind || "regular"} onValueChange={(v) => setEditDraft({ ...editDraft, default_session_kind: v, default_session_subtype: defaultSubtypeFor(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{editDraft.default_session_kind === "test" ? "نوع الاختبار" : editDraft.default_session_kind === "assessment" ? "نوع التقييم" : "تخصص الجلسة"}</Label>
                      <Select value={editDraft.default_session_subtype || defaultSubtypeFor(editDraft.default_session_kind || "regular")} onValueChange={(v) => setEditDraft({ ...editDraft, default_session_subtype: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {subtypeOptions(editDraft.default_session_kind || "regular").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>طريقة الدفع</Label>
                      <Select value={editDraft.payment_type || "per_session"} onValueChange={(v) => setEditDraft({ ...editDraft, payment_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TYPE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>نسبة الخصم %</Label>
                      <Input
                        type="number" min={0} max={100} step="0.01" inputMode="decimal"
                        value={editDraft.discount_percentage ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, discount_percentage: e.target.value as any })}
                        placeholder="مثال: 12.5"
                      />
                    </div>


                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                      <Label>ملاحظات</Label>
                      <Input value={editDraft.notes ?? ""} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                      <Button onClick={saveEdit} disabled={savingEdit}>
                        <Save className="h-4 w-4 ml-1" />
                        {savingEdit ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                      </Button>
                      <Button variant="outline" onClick={cancelEdit} disabled={savingEdit}>إلغاء</Button>
                      <Button variant="outline" onClick={() => regenerate(c)} disabled={savingEdit} title="إعادة توليد المواعيد القادمة بعد التعديل">
                        <RefreshCw className="h-4 w-4 ml-1" />
                        إعادة توليد المواعيد
                      </Button>
                    </div>
                  </div>
                )}
                {expanded[c.id] && (
                  <div className="mt-3 rounded-md border bg-muted/30 p-2">
                    {apptLoading[c.id] ? (
                      <p className="text-xs text-center text-muted-foreground py-2">جارٍ التحميل...</p>
                    ) : (appts[c.id]?.length ?? 0) === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-2">لا توجد مواعيد قادمة</p>
                    ) : (
                      <ul className="space-y-1">
                        {appts[c.id].map((a) => (
                          <li key={a.id} className="text-xs flex items-center justify-between gap-2 px-2 py-1 rounded bg-background">
                            <span>
                              {new Date(a.scheduled_date).toLocaleDateString("ar-EG", { weekday: "short", day: "2-digit", month: "2-digit" })}
                              <span dir="ltr"> · {fmtTime12(a.scheduled_time)}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{KIND_LABEL[a.session_kind] || a.session_kind}</span>
                              {a.status !== "scheduled" && (
                                <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">{a.status}</span>
                              )}
                              {canManage && c.whatsapp && (() => {
                                const link = waLink(c.whatsapp, formatAppointmentMessage({
                                  caseName: c.name,
                                  date: a.scheduled_date,
                                  time: a.scheduled_time,
                                  durationMinutes: c.default_duration_minutes,
                                  specialistName: profilesMap[c.specialist_id],
                                  sessionKindLabel: a.session_kind !== "regular" ? KIND_LABEL[a.session_kind] : null,
                                }));
                                return link ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 px-1.5 py-0.5">
                                    <MessageCircle className="h-3 w-3" />
                                    واتساب
                                  </a>
                                ) : null;
                              })()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!logCase} onOpenChange={(o) => !o && closeQuickLog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل جلسة — {logCase?.name}</DialogTitle>
          </DialogHeader>
          {logCase && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                سيتم تسجيل جلسة بتاريخ اليوم وقت الآن، بسعر {Number(logCase.default_cost).toFixed(2)} ومدة {logCase.default_duration_minutes} دقيقة، للأخصائي{" "}
                <b>{profilesMap[logCase.specialist_id] || "—"}</b>.
              </p>
              <div className="space-y-1.5">
                <Label>ما تم خلال الجلسة (اختياري)</Label>
                <Textarea
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  rows={4}
                  placeholder="ملاحظات الجلسة، الأنشطة، التقدم..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeQuickLog} disabled={logSubmitting}>إلغاء</Button>
            <Button onClick={submitQuickLog} disabled={logSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {logSubmitting ? "جارٍ الحفظ..." : "حفظ الجلسة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

