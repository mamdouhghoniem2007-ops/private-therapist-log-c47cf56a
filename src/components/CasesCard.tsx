import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Plus, Trash2, RefreshCw, Calendar, ChevronDown, ChevronUp, MessageCircle, Pencil, X, Save } from "lucide-react";
import { waLink, formatAppointmentMessage } from "@/lib/whatsapp";

type CaseAppt = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  session_kind: string;
};

const KIND_LABEL: Record<string, string> = {
  regular: "عادية",
  initial_assessment: "تقييم مبدئي",
  test: "اختبار",
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
  start_date: string;
  active: boolean;
  notes: string | null;
};

const DAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const DURATION_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
const PERCENTAGE_OPTIONS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
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

  // form
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [specialistId, setSpecialistId] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState("16:00");
  const [duration, setDuration] = useState(45);
  const [cost, setCost] = useState<number | "">("");
  const [percentage, setPercentage] = useState(50);
  const [startDate, setStartDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);

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
    setName(""); setWhatsapp(""); setDays([]); setCost(""); setShowForm(false);
  };

  const addCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialistId) return toast.error("اختر الأخصائي");
    if (days.length === 0) return toast.error("اختر أيام الأسبوع");
    if (cost === "" || cost < 0) return toast.error("أدخل سعر الجلسة");
    setSubmitting(true);
    const { error } = await supabase.from("cases").insert({
      name: name.trim(),
      whatsapp: whatsapp.trim() || null,
      specialist_id: specialistId,
      recurring_days: days,
      recurring_time: time,
      default_duration_minutes: duration,
      default_cost: Number(cost),
      default_specialist_percentage: percentage,
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
            <div className="space-y-1.5">
              <Label>سعر الجلسة</Label>
              <Input type="number" min={0} step="0.01" required value={cost}
                onChange={(e) => setCost(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>نسبة الأخصائي</Label>
              <Select value={String(percentage)} onValueChange={(v) => setPercentage(+v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERCENTAGE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.recurring_days.map((d) => DAY_LABELS[d]).join("، ") || "—"}
                      <span dir="ltr"> · {c.recurring_time.slice(0, 5)}</span>
                      {" · "}{c.default_duration_minutes} د
                      {" · "}{Number(c.default_cost).toFixed(2)} ({c.default_specialist_percentage}%)
                      {c.whatsapp && <span dir="ltr"> · {c.whatsapp}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => toggleExpand(c)}>
                      <Calendar className="h-4 w-4 ml-1" />
                      المواعيد
                      {expanded[c.id] ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    </Button>
                    {canManage && c.whatsapp && (() => {
                      const link = waLink(c.whatsapp, `السلام عليكم، بخصوص جلسات "${c.name}" — مركز رعاية.`);
                      return link ? (
                        <Button asChild size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10">
                          <a href={link} target="_blank" rel="noopener noreferrer">
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
                        <Button variant="ghost" size="icon" onClick={() => remove(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
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
                              <span dir="ltr"> · {a.scheduled_time.slice(0, 5)}</span>
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
    </Card>
  );
}
