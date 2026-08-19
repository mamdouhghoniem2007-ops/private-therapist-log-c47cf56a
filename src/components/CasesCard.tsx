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
import { Users, Plus, Trash2, RefreshCw, Calendar, ChevronDown, ChevronUp, MessageCircle, Pencil, X, Save, FileText, PlayCircle, Pause, Play, Sparkles, Archive, ArchiveRestore, Wallet, ClipboardList } from "lucide-react";
import { waLink, formatAppointmentMessage } from "@/lib/whatsapp";
import { fmtTime12 } from "@/lib/utils";
import { SlotSuggestionsDialog, type Suggestion } from "./SlotSuggestionsDialog";
import { CasePaymentsDialog, type PaymentCase } from "./CasePaymentsDialog";

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
  birth_date: string | null;
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
  archived: boolean;
  notes: string | null;
  payment_type: string;
  discount_percentage: number;
  counter_base_number: number;
  counter_start_date: string;
  sessions_per_cycle: number;
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
  const [showArchive, setShowArchive] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [paymentsCase, setPaymentsCase] = useState<PaymentCase | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [appts, setAppts] = useState<Record<string, CaseAppt[]>>({});
  const [apptLoading, setApptLoading] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CaseRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cycleCounts, setCycleCounts] = useState<Record<string, number>>({});

  // حساب موضع الجلسة الحالية داخل الدورة (مثال: الجلسة 6 من 8)
  const cycleInfo = (c: CaseRow) => {
    const per = Math.max(1, Number(c.sessions_per_cycle) || 8);
    const base = Math.max(1, Number(c.counter_base_number) || 1);
    const attended = cycleCounts[c.id] || 0;
    const total = base - 1 + attended; // إجمالي الجلسات المحسوبة
    const current = total === 0 ? 0 : ((total - 1) % per) + 1;
    const remaining = total === 0 ? per : per - current;
    return { per, total, current, remaining, done: total > 0 && current === per };
  };

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
      birth_date: editDraft.birth_date || null,
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
      counter_base_number: Math.max(1, Number(editDraft.counter_base_number) || 1),
      counter_start_date: editDraft.counter_start_date || editDraft.start_date,
      sessions_per_cycle: Math.max(1, Number(editDraft.sessions_per_cycle) || 8),
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

  // Update a single appointment status from inside a case row (admin/supervisor)
  const setApptStatus = async (
    c: CaseRow,
    apptId: string,
    kind: "attended" | "apologized" | "absent" | "scheduled",
  ) => {
    const nowIso = new Date().toISOString();
    const patch =
      kind === "attended"
        ? { status: "attended", ended_at: nowIso }
        : kind === "scheduled"
        ? { status: "scheduled", started_at: null, ended_at: null }
        : { status: kind, started_at: null, ended_at: null };
    const { error } = await supabase.from("appointments").update(patch).eq("id", apptId);
    if (error) { toast.error(error.message); return; }
    setAppts((a) => {
      const list = a[c.id];
      if (!list) return a;
      return { ...a, [c.id]: list.map((x) => x.id === apptId ? { ...x, status: patch.status } : x) };
    });
    toast.success(
      kind === "attended" ? "تم تسجيل الحضور" :
      kind === "apologized" ? "تم تسجيل الاعتذار" :
      kind === "absent" ? "تم تسجيل الغياب" : "تم إرجاع الموعد",
    );
  };

  const removeAppt = async (c: CaseRow, apptId: string) => {
    if (!confirm("حذف هذا الموعد؟")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", apptId);
    if (error) { toast.error(error.message); return; }
    setAppts((a) => {
      const list = a[c.id];
      if (!list) return a;
      return { ...a, [c.id]: list.filter((x) => x.id !== apptId) };
    });
    toast.success("تم حذف الموعد");
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

  // شيت الحضور والمدفوعات لكل طفل — بأثر رجعي من 1 يونيو 2026
  const openAttendanceSheet = async (c: CaseRow) => {
    const FROM = "2026-06-01";
    const todayStr = today();
    const { data, error } = await supabase
      .from("appointments")
      .select("scheduled_date, scheduled_time, duration_minutes, session_kind, session_type, test_type, status, cost, discount_percentage, payment_type")
      .eq("case_id", c.id)
      .gte("scheduled_date", FROM)
      .lte("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true });
    if (error) { toast.error(error.message); return; }

    const rows = (data as any[]) || [];
    const statusLabel = (s: string) =>
      s === "attended" ? "حضر" :
      s === "apologized" ? "اعتذار" :
      s === "absent" ? "غياب" :
      s === "cancelled" ? "ملغي" : "مجدول";
    const statusClass = (s: string) =>
      s === "attended" ? "ok" : s === "apologized" ? "warn" : s === "absent" ? "bad" : "";

    let totalAttended = 0, totalAbsent = 0, totalApology = 0, totalPaid = 0;
    const bodyRows = rows.map((r) => {
      const cost = Number(r.cost) || 0;
      const disc = Number(r.discount_percentage) || 0;
      const net = +(cost * (1 - disc / 100)).toFixed(2);
      const paid = r.status === "attended" ? net : 0;
      if (r.status === "attended") { totalAttended++; totalPaid += paid; }
      else if (r.status === "absent") totalAbsent++;
      else if (r.status === "apologized") totalApology++;
      const kind = r.test_type || r.session_type || KIND_LABEL[r.session_kind] || r.session_kind || "جلسة";
      return `<tr class="${statusClass(r.status)}">
        <td>${r.scheduled_date}</td>
        <td>${fmtTime12(r.scheduled_time)}</td>
        <td>${r.duration_minutes || ""}</td>
        <td>${kind}</td>
        <td>${statusLabel(r.status)}</td>
        <td>${cost ? cost.toFixed(2) : "—"}</td>
        <td>${disc ? disc + "%" : "—"}</td>
        <td>${net ? net.toFixed(2) : "—"}</td>
        <td>${paid ? paid.toFixed(2) : "—"}</td>
      </tr>`;
    }).join("");

    const headers = ["التاريخ", "الوقت", "المدة (د)", "النوع", "الحالة", "السعر", "الخصم", "الصافي", "المدفوع"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + [
      headers.map(esc).join(","),
      ...rows.map((r) => {
        const cost = Number(r.cost) || 0;
        const disc = Number(r.discount_percentage) || 0;
        const net = +(cost * (1 - disc / 100)).toFixed(2);
        const paid = r.status === "attended" ? net : 0;
        const kind = r.test_type || r.session_type || KIND_LABEL[r.session_kind] || r.session_kind || "جلسة";
        return [r.scheduled_date, fmtTime12(r.scheduled_time), r.duration_minutes || "", kind, statusLabel(r.status), cost || "", disc || "", net || "", paid || ""].map(esc).join(",");
      }),
    ].join("\n");
    const csvDataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const fileName = `شيت-حضور-${c.name}-${todayStr}.csv`;

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>شيت الحضور والمدفوعات - ${c.name}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:22px;color:#111}
      h1{margin:0 0 4px;font-size:20px}
      .meta{color:#555;font-size:12px;margin-bottom:10px}
      .summary{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 14px}
      .chip{padding:8px 12px;border:1px solid #ccc;border-radius:8px;font-size:13px;background:#fafafa}
      .chip b{font-size:15px;margin-inline-start:6px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #999;padding:6px 7px;text-align:center;vertical-align:top}
      thead{background:#f0f0f0}
      tr.ok{background:#effaf0}
      tr.warn{background:#fff7e6}
      tr.bad{background:#fdecec}
      tfoot td{font-weight:bold;background:#f5f5f5}
      .toolbar{margin:0 0 14px;display:flex;gap:10px;flex-wrap:wrap}
      .toolbar a,.toolbar button{padding:8px 14px;font-size:13px;border:1px solid #888;border-radius:6px;background:#fafafa;cursor:pointer;text-decoration:none;color:#111}
      @media print { .noprint{display:none} body{padding:10px} }
    </style></head><body>
    <h1>شيت الحضور والمدفوعات — ${c.name}</h1>
    <div class="meta">
      الأخصائي: ${profilesMap[c.specialist_id] || "—"} ·
      طريقة الدفع: ${PAYMENT_TYPE_LABEL[c.payment_type] || c.payment_type} ·
      الفترة: من ${FROM} إلى ${todayStr} ·
      تاريخ الطباعة: ${new Date().toLocaleString("ar-EG")}
    </div>
    <div class="summary">
      <div class="chip">إجمالي المواعيد <b>${rows.length}</b></div>
      <div class="chip">حضور <b style="color:#137333">${totalAttended}</b></div>
      <div class="chip">اعتذار <b style="color:#a15c00">${totalApology}</b></div>
      <div class="chip">غياب <b style="color:#b3261e">${totalAbsent}</b></div>
      <div class="chip">إجمالي المدفوع <b>${totalPaid.toFixed(2)}</b></div>
    </div>
    <div class="toolbar noprint">
      <button onclick="window.print()">طباعة</button>
      <a href="${csvDataUri}" download="${fileName}">تنزيل Excel/CSV</a>
    </div>
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${headers.length}">لا توجد مواعيد في هذه الفترة</td></tr>`}</tbody>
      <tfoot><tr>
        <td colspan="4">الإجمالي</td>
        <td>${totalAttended} حضور · ${totalApology} اعتذار · ${totalAbsent} غياب</td>
        <td colspan="3">—</td>
        <td>${totalPaid.toFixed(2)}</td>
      </tr></tfoot>
    </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error("فشل فتح النافذة — تأكد من السماح بالنوافذ المنبثقة"); return; }
    w.document.write(html);
    w.document.close();
  };


  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");
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

  // كارت المتابعة — جلسات مرقّمة حسب الدورة
  const openFollowUpCard = async (c: CaseRow) => {
    const info = cycleInfo(c);
    const from = c.counter_start_date || c.start_date;
    const todayStr = today();
    const { data, error } = await supabase
      .from("appointments")
      .select("scheduled_date, scheduled_time, duration_minutes, session_kind, session_type, test_type, status, notes")
      .eq("case_id", c.id)
      .gte("scheduled_date", from)
      .lte("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true });
    if (error) { toast.error(error.message); return; }
    const rows = (data as any[]) || [];
    const per = info.per;
    const base = Math.max(1, Number(c.counter_base_number) || 1);
    let n = base - 1;
    const statusLabel = (s: string) =>
      s === "attended" ? "حضر" : s === "apologized" ? "اعتذار" : s === "absent" ? "غياب" : s === "cancelled" ? "ملغي" : "مجدول";
    const body = rows.map((r) => {
      let numCell = "—";
      let cls = "";
      if (r.status === "attended") {
        n += 1;
        const pos = ((n - 1) % per) + 1;
        numCell = `${pos} / ${per}`;
        cls = pos === per ? "cycle-end" : "ok";
      } else if (r.status === "absent") cls = "bad";
      else if (r.status === "apologized") cls = "warn";
      const kind = r.test_type || r.session_type || KIND_LABEL[r.session_kind] || "جلسة";
      return `<tr class="${cls}">
        <td>${numCell}</td>
        <td>${r.scheduled_date}</td>
        <td>${fmtTime12(r.scheduled_time)}</td>
        <td>${kind}</td>
        <td>${statusLabel(r.status)}</td>
        <td style="text-align:right">${(r.notes || "").replace(/</g, "&lt;")}</td>
      </tr>`;
    }).join("");

    const headers = ["رقم الجلسة", "التاريخ", "الوقت", "النوع", "الحالة", "ملاحظات"];
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>كارت متابعة - ${c.name}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:22px;color:#111}
      h1{margin:0 0 4px;font-size:20px}
      .meta{color:#555;font-size:12px;margin-bottom:10px}
      .summary{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 14px}
      .chip{padding:8px 12px;border:1px solid #ccc;border-radius:8px;font-size:13px;background:#fafafa}
      .chip b{font-size:15px;margin-inline-start:6px}
      .alert{padding:10px 12px;border-radius:8px;background:#fff4e5;border:1px solid #f0b429;font-size:13px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #999;padding:6px 7px;text-align:center;vertical-align:top}
      thead{background:#f0f0f0}
      tr.ok{background:#effaf0} tr.warn{background:#fff7e6} tr.bad{background:#fdecec}
      tr.cycle-end{background:#e6f0ff;font-weight:bold}
      .toolbar{margin:0 0 14px}
      .toolbar button{padding:8px 14px;font-size:13px;border:1px solid #888;border-radius:6px;background:#fafafa;cursor:pointer}
      @media print { .noprint{display:none} body{padding:10px} }
    </style></head><body>
    <h1>كارت متابعة — ${c.name}</h1>
    <div class="meta">
      الأخصائي: ${profilesMap[c.specialist_id] || "—"} ·
      بداية العد: ${from} (من الجلسة رقم ${base}) ·
      دورة كل ${per} جلسات ·
      تاريخ الطباعة: ${new Date().toLocaleString("ar-EG")}
    </div>
    ${info.done ? `<div class="alert">🔔 هذا الطفل أكمل ${per} جلسات — انتهت جلسات الدورة الحالية.</div>` : ""}
    <div class="summary">
      <div class="chip">الجلسة الحالية <b>${info.current || 0} من ${per}</b></div>
      <div class="chip">المتبقي في الدورة <b>${info.remaining}</b></div>
      <div class="chip">إجمالي الجلسات المحضورة <b>${info.total}</b></div>
    </div>
    <div class="toolbar noprint"><button onclick="window.print()">طباعة</button></div>
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body || `<tr><td colspan="${headers.length}">لا توجد جلسات بعد تاريخ بداية العد</td></tr>`}</tbody>
    </table>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("فشل فتح النافذة — تأكد من السماح بالنوافذ المنبثقة"); return; }
    w.document.write(html);
    w.document.close();
  };

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
    const list = (data as CaseRow[]) || [];
    setCases(list);
    setLoading(false);
    // عدّاد الجلسات المحضورة لكل حالة اعتبارًا من تاريخ بداية العد
    if (list.length) {
      const { data: aData } = await supabase
        .from("appointments")
        .select("case_id, scheduled_date")
        .in("case_id", list.map((c) => c.id))
        .eq("status", "attended");
      const startById: Record<string, string> = {};
      list.forEach((c) => { startById[c.id] = c.counter_start_date; });
      const map: Record<string, number> = {};
      ((aData as any[]) || []).forEach((r) => {
        if (!r.case_id) return;
        const s = startById[r.case_id];
        if (s && r.scheduled_date < s) return;
        map[r.case_id] = (map[r.case_id] || 0) + 1;
      });
      setCycleCounts(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!specialistId && specialists.length) setSpecialistId(specialists[0].id);
  }, [specialists, specialistId]);

  const toggleDay = (d: number) =>
    setDays((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort());
  const resetForm = () => {
    setName(""); setWhatsapp(""); setBirthDate(""); setDays([]); setCost(""); setCostSelect("");
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
      birth_date: birthDate || null,
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
    if (c.active) {
      const ok = window.confirm(`سيتم إيقاف الحالة "${c.name}" وحذف كل المواعيد المستقبلية غير المبدوءة لها، ولن يتم توليد مواعيد جديدة. هل أنت متأكد؟`);
      if (!ok) return;
    }
    const { error } = await supabase.from("cases").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((x) => x.id === c.id ? { ...x, active: !c.active } : x));
    toast.success(!c.active ? "تم تفعيل الحالة وتوليد المواعيد" : "تم إيقاف الحالة وإلغاء توليد المواعيد");
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

  const toggleArchive = async (c: CaseRow) => {
    const next = !c.archived;
    if (next && c.active) {
      const ok = window.confirm(`الحالة "${c.name}" لا تزال مفعّلة. سيتم إيقافها وأرشفتها. هل تريد المتابعة؟`);
      if (!ok) return;
    }
    const payload: { archived: boolean; active?: boolean } = { archived: next };
    if (next && c.active) payload.active = false;
    const { error } = await supabase.from("cases").update(payload).eq("id", c.id);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((x) => x.id === c.id ? { ...x, ...payload } as CaseRow : x));
    toast.success(next ? "تم نقل الحالة إلى الأرشيف" : "تم استرجاع الحالة من الأرشيف");
  };

  const visibleCases = useMemo(() => {
    const base = canManage ? cases : cases.filter((c) => c.specialist_id === user.id);
    return base.filter((c) => showArchive ? c.archived : !c.archived);
  }, [cases, canManage, user.id, showArchive]);

  const archivedCount = useMemo(
    () => (canManage ? cases : cases.filter((c) => c.specialist_id === user.id)).filter((c) => c.archived).length,
    [cases, canManage, user.id]
  );

  return (
    <Card className="shadow-[var(--shadow-card)] border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {showArchive ? "أرشيف الحالات" : "ملف الحالات"}
            <span className="text-xs text-muted-foreground font-normal">({visibleCases.length})</span>
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={showArchive ? "default" : "outline"}
              onClick={() => setShowArchive((s) => !s)}
              title={showArchive ? "العودة للحالات النشطة" : "عرض الأرشيف"}
            >
              <Archive className="h-4 w-4 ml-1" />
              {showArchive ? "العودة" : `الأرشيف${archivedCount ? ` (${archivedCount})` : ""}`}
            </Button>
            {canManage && !showArchive && (
              <Button size="sm" variant={showForm ? "secondary" : "default"} onClick={() => setShowForm((s) => !s)}>
                <Plus className="h-4 w-4 ml-1" />
                {showForm ? "إغلاق" : "إضافة حالة"}
              </Button>
            )}
          </div>
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
            <div className="space-y-1.5">
              <Label>تاريخ ميلاد الطفل</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>أيام الأسبوع المتكررة</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSuggestOpen(true)}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4 ml-1" />
                  اقتراح مواعيد فاضية
                </Button>
              </div>
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
                      {!c.active && <span className="text-xs rounded bg-destructive/10 text-destructive border border-destructive/30 px-2 py-0.5 font-medium">موقوفة — لا يتم توليد مواعيد</span>}
                      <span className="text-xs text-muted-foreground">— {profilesMap[c.specialist_id] || "—"}</span>
                      <span className="text-[10px] rounded bg-primary/10 text-primary px-1.5 py-0.5">
                        {KIND_OPTIONS.find((k) => k.value === (c.default_session_kind || "regular"))?.label}
                      </span>
                      {(() => {
                        const info = cycleInfo(c);
                        return (
                          <span
                            className={`text-[10px] rounded px-1.5 py-0.5 border font-medium ${
                              info.done
                                ? "bg-amber-500/15 text-amber-700 border-amber-500/40"
                                : "bg-sky-500/10 text-sky-700 border-sky-500/30"
                            }`}
                            title="عدّاد جلسات الدورة"
                          >
                            {info.done
                              ? `خلص جلسات الدورة (${info.per}/${info.per}) 🔔`
                              : `الجلسة ${info.current || 0} من ${info.per} — فاضل ${info.remaining}`}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.recurring_days.map((d) => DAY_LABELS[d]).join("، ") || "—"}
                      <span dir="ltr"> · {fmtTime12(c.recurring_time)}</span>
                      {" · "}{c.default_duration_minutes} د
                      {canSeeFinancial && (
                        <>
                          {" · "}{Number(c.default_cost).toFixed(2)} ({c.default_specialist_percentage}%)
                          {" · "}{PAYMENT_TYPE_LABEL[c.payment_type] || "بالجلسة"}
                          {Number(c.discount_percentage) > 0 && (
                            <span className="text-amber-700"> · خصم {Number(c.discount_percentage)}%</span>
                          )}
                        </>
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
                    <Button size="sm" variant="outline" className="border-sky-500/50 text-sky-700 hover:bg-sky-500/10" onClick={() => openFollowUpCard(c)} title="كارت متابعة مطبوع بترقيم الجلسات">
                      <ClipboardList className="h-4 w-4 ml-1" />
                      كارت المتابعة
                    </Button>
                    {canSeeFinancial && (
                      <Button size="sm" variant="outline" onClick={() => openAttendanceSheet(c)} title="شيت الحضور والمدفوعات من 1 يونيو 2026">
                        <FileText className="h-4 w-4 ml-1" />
                        شيت الحضور
                      </Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10" onClick={() => setPaymentsCase(c)} title="المدفوعات والفواتير">
                        <Wallet className="h-4 w-4 ml-1" />
                        المدفوعات
                      </Button>
                    )}
                    {c.active && !isSupervisor && (role === "admin" || c.specialist_id === user.id) && (
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
                            cost: c.default_cost,
                            discountPercentage: c.discount_percentage,
                            sessionKindLabel: KIND_LABEL[next.session_kind] || "جلسة",
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
                        {c.active && (
                          <Button size="sm" variant="outline" onClick={() => regenerate(c)} title="توليد مواعيد 8 أسابيع قادمة">
                            <RefreshCw className="h-4 w-4 ml-1" />
                            توليد
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(c)}
                          className={c.active
                            ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                            : "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"}
                          title={c.active ? "إيقاف الحالة وإلغاء توليد المواعيد" : "تفعيل الحالة وتوليد المواعيد"}
                        >
                          {c.active ? <Pause className="h-4 w-4 ml-1" /> : <Play className="h-4 w-4 ml-1" />}
                          {c.active ? "إيقاف التوليد" : "تفعيل وتوليد"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleArchive(c)}
                          className={c.archived
                            ? "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-700 hover:bg-amber-500/10"}
                          title={c.archived ? "استرجاع من الأرشيف" : "نقل إلى الأرشيف"}
                        >
                          {c.archived ? <ArchiveRestore className="h-4 w-4 ml-1" /> : <Archive className="h-4 w-4 ml-1" />}
                          {c.archived ? "استرجاع" : "أرشفة"}
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
                      <Label>تاريخ ميلاد الطفل</Label>
                      <Input type="date" value={editDraft.birth_date ?? ""} onChange={(e) => setEditDraft({ ...editDraft, birth_date: e.target.value })} />
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
                    {canSeeFinancial && (
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
                    )}
                    {canSeeFinancial && (
                    <div className="space-y-1.5">
                      <Label>نسبة الأخصائي %</Label>
                      <Input
                        type="number" min={0} max={100} step="0.01"
                        value={editDraft.default_specialist_percentage ?? 0}
                        onChange={(e) => setEditDraft({ ...editDraft, default_specialist_percentage: e.target.value === "" ? 0 : +e.target.value })}
                        placeholder="مثال: 12.5"
                      />
                    </div>
                    )}
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
                    {canSeeFinancial && (
                    <div className="space-y-1.5">
                      <Label>طريقة الدفع</Label>
                      <Select value={editDraft.payment_type || "per_session"} onValueChange={(v) => setEditDraft({ ...editDraft, payment_type: v })}>
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
                        value={editDraft.discount_percentage ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, discount_percentage: e.target.value as any })}
                        placeholder="مثال: 12.5"
                      />
                    </div>
                    )}

                    <div className="space-y-1.5">
                      <Label>رقم أول جلسة (بداية العد)</Label>
                      <Input
                        type="number" min={1} step={1}
                        value={editDraft.counter_base_number ?? 1}
                        onChange={(e) => setEditDraft({ ...editDraft, counter_base_number: e.target.value === "" ? 1 : +e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>تاريخ بداية العد</Label>
                      <Input
                        type="date"
                        value={editDraft.counter_start_date ?? editDraft.start_date}
                        onChange={(e) => setEditDraft({ ...editDraft, counter_start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>عدد جلسات الدورة</Label>
                      <Input
                        type="number" min={1} step={1}
                        value={editDraft.sessions_per_cycle ?? 8}
                        onChange={(e) => setEditDraft({ ...editDraft, sessions_per_cycle: e.target.value === "" ? 8 : +e.target.value })}
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
                          <li key={a.id} className="text-xs flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded bg-background">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span>
                                {new Date(a.scheduled_date).toLocaleDateString("ar-EG", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                <span dir="ltr"> · {fmtTime12(a.scheduled_time)}</span>
                              </span>
                              <span className="text-muted-foreground">— {KIND_LABEL[a.session_kind] || a.session_kind}</span>
                              {a.status === "attended" && <span className="rounded bg-blue-500/15 text-blue-700 px-1.5 py-0.5 font-semibold">حضرت</span>}
                              {(a.status === "apologized" || a.status === "cancelled") && <span className="rounded bg-orange-500/15 text-orange-700 px-1.5 py-0.5 font-semibold">معتذرة</span>}
                              {a.status === "absent" && <span className="rounded bg-red-500/15 text-red-700 px-1.5 py-0.5 font-semibold">غائبة</span>}
                            </span>
                            <span className="flex items-center gap-1 flex-wrap">
                              {canManage && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={a.status === "attended" ? "default" : "outline"}
                                    className={`h-6 px-2 text-[11px] ${a.status === "attended" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-500/50 text-blue-700 hover:bg-blue-500/10"}`}
                                    onClick={() => setApptStatus(c, a.id, "attended")}
                                  >حضرت</Button>
                                  <Button
                                    size="sm"
                                    variant={(a.status === "apologized" || a.status === "cancelled") ? "default" : "outline"}
                                    className={`h-6 px-2 text-[11px] ${(a.status === "apologized" || a.status === "cancelled") ? "bg-orange-500 hover:bg-orange-600 text-white" : "border-orange-500/50 text-orange-700 hover:bg-orange-500/10"}`}
                                    onClick={() => setApptStatus(c, a.id, "apologized")}
                                  >معتذرة</Button>
                                  <Button
                                    size="sm"
                                    variant={a.status === "absent" ? "default" : "outline"}
                                    className={`h-6 px-2 text-[11px] ${a.status === "absent" ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-500/50 text-red-700 hover:bg-red-500/10"}`}
                                    onClick={() => setApptStatus(c, a.id, "absent")}
                                  >غائبة</Button>
                                  {a.status !== "scheduled" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[11px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                                      onClick={() => setApptStatus(c, a.id, "scheduled")}
                                    >إرجاع</Button>
                                  )}
                                </>
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
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => removeAppt(c, a.id)}
                                  title="حذف الموعد"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
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

      <SlotSuggestionsDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        specialists={specialists}
        initialSpecialistId={specialistId}
        initialDays={days}
        durationMinutes={duration}
        onPick={(s: Suggestion) => {
          setSpecialistId(s.specialistId);
          setDays([s.dayOfWeek]);
          setTime(s.time);
          setShowForm(true);
          toast.success(`تم تعبئة النموذج بـ ${s.specialistName} — ${DAY_LABELS[s.dayOfWeek]} ${s.time}`);
        }}
      />

      <CasePaymentsDialog
        open={!!paymentsCase}
        onOpenChange={(v) => { if (!v) setPaymentsCase(null); }}
        caseRow={paymentsCase}
        specialistName={paymentsCase ? (profilesMap[paymentsCase.specialist_id] || "") : ""}
        currentUserId={user.id}
      />

    </Card>
  );
}

