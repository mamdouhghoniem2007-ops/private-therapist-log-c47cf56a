import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog, Download, Printer } from "lucide-react";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { fmtTime12 } from "@/lib/utils";

type Profile = { id: string; full_name: string };

type SessionRow = {
  id: string;
  specialist_id: string;
  case_name: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  cost: number;
  specialist_percentage: number;
  discount_percentage: number;
  payment_type: string;
  session_type: string | null;
  test_type: string | null;
  notes: string | null;
};

type AppointmentRow = {
  id: string;
  specialist_id: string;
  case_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  cost: number | null;
  specialist_percentage: number;
  discount_percentage: number;
  payment_type: string;
  session_kind: string;
  session_type: string | null;
  test_type: string | null;
  status: string;
  case_whatsapp: string | null;
  notes: string | null;
};

type CaseRow = {
  id: string;
  name: string;
  specialist_id: string;
  whatsapp: string | null;
  recurring_time: string;
  recurring_days: number[];
  default_duration_minutes: number;
  default_cost: number;
  default_specialist_percentage: number;
  discount_percentage: number;
  payment_type: string;
  active: boolean;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function SpecialistsAdminCard({ specialists }: { specialists: Profile[] }) {
  const [specialistId, setSpecialistId] = useState<string>("");
  const [tab, setTab] = useState<"sessions" | "appointments" | "cases" | "availability">("sessions");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Date-range filter for sessions log
  const monthStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const [fromDate, setFromDate] = useState<string>(monthStart());
  const [toDate, setToDate] = useState<string>(today());

  // edit dialog state
  const [editKind, setEditKind] = useState<null | "session" | "appointment" | "case">(null);
  const [editMode, setEditMode] = useState<"create" | "edit">("edit");
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (!specialistId && specialists.length) setSpecialistId(specialists[0].id);
  }, [specialists, specialistId]);

  const load = async () => {
    if (!specialistId) return;
    setLoading(true);
    const [s, a, c] = await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .eq("specialist_id", specialistId)
        .order("session_date", { ascending: false })
        .order("session_time", { ascending: false })
        .limit(500),
      supabase
        .from("appointments")
        .select("*")
        .eq("specialist_id", specialistId)
        .order("scheduled_date", { ascending: false })
        .order("scheduled_time", { ascending: false })
        .limit(500),
      supabase
        .from("cases")
        .select("*")
        .eq("specialist_id", specialistId)
        .order("name"),
    ]);
    if (s.error) toast.error(s.error.message);
    else setSessions((s.data as SessionRow[]) || []);
    if (a.error) toast.error(a.error.message);
    else setAppointments((a.data as AppointmentRow[]) || []);
    if (c.error) toast.error(c.error.message);
    else setCases((c.data as CaseRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialistId]);

  const specialistName = useMemo(
    () => specialists.find((p) => p.id === specialistId)?.full_name || "—",
    [specialists, specialistId],
  );

  // ---- delete handlers ----
  const removeSession = async (id: string) => {
    if (!confirm("تأكيد حذف الجلسة؟")) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSessions((x) => x.filter((r) => r.id !== id));
    toast.success("تم الحذف");
  };
  const removeAppointment = async (id: string) => {
    if (!confirm("تأكيد حذف الموعد؟")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((x) => x.filter((r) => r.id !== id));
    toast.success("تم الحذف");
  };
  const removeCase = async (id: string) => {
    if (!confirm("تأكيد حذف الحالة؟ سيتم حذف المواعيد المرتبطة غير المنفذة.")) return;
    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCases((x) => x.filter((r) => r.id !== id));
    toast.success("تم الحذف");
  };

  // ---- open dialogs ----
  const openCreate = (kind: "session" | "appointment" | "case") => {
    setEditKind(kind);
    setEditMode("create");
    if (kind === "session") {
      setEditData({
        specialist_id: specialistId,
        case_name: "",
        session_date: today(),
        session_time: "10:00",
        duration_minutes: 45,
        cost: 0,
        specialist_percentage: 50,
        discount_percentage: 0,
        payment_type: "per_session",
        notes: "",
      });
    } else if (kind === "appointment") {
      setEditData({
        specialist_id: specialistId,
        case_name: "",
        scheduled_date: today(),
        scheduled_time: "10:00",
        duration_minutes: 45,
        cost: 0,
        specialist_percentage: 50,
        discount_percentage: 0,
        payment_type: "per_session",
        session_kind: "regular",
        status: "scheduled",
        case_whatsapp: "",
        notes: "",
      });
    } else {
      setEditData({
        specialist_id: specialistId,
        name: "",
        whatsapp: "",
        recurring_time: "10:00",
        recurring_days: [],
        default_duration_minutes: 45,
        default_cost: 0,
        default_specialist_percentage: 50,
        discount_percentage: 0,
        payment_type: "per_session",
        active: true,
        notes: "",
      });
    }
  };
  const openEdit = (kind: "session" | "appointment" | "case", row: any) => {
    setEditKind(kind);
    setEditMode("edit");
    setEditData({ ...row });
  };
  const closeDialog = () => {
    setEditKind(null);
    setEditData(null);
  };

  const saveDialog = async () => {
    if (!editKind || !editData) return;
    const table =
      editKind === "session" ? "sessions" : editKind === "appointment" ? "appointments" : "cases";
    const payload: any = { ...editData };
    // normalize numerics
    ["cost", "specialist_percentage", "discount_percentage", "duration_minutes",
     "default_cost", "default_specialist_percentage", "default_duration_minutes"].forEach((k) => {
      if (payload[k] !== undefined && payload[k] !== null && payload[k] !== "") payload[k] = Number(payload[k]);
    });
    // trim time to HH:MM:SS
    if (payload.session_time && payload.session_time.length === 5) payload.session_time += ":00";
    if (payload.scheduled_time && payload.scheduled_time.length === 5) payload.scheduled_time += ":00";
    if (payload.recurring_time && payload.recurring_time.length === 5) payload.recurring_time += ":00";

    if (editMode === "create") {
      const { id, ...insertPayload } = payload;
      const { error } = await supabase.from(table).insert(insertPayload);
      if (error) return toast.error(error.message);
      toast.success("تم الإضافة");
    } else {
      const { id, ...updatePayload } = payload;
      const { error } = await supabase.from(table).update(updatePayload).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("تم الحفظ");
    }
    closeDialog();
    load();
  };

  const setField = (k: string, v: any) => setEditData((d: any) => ({ ...d, [k]: v }));

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4 text-primary" />
          إدارة بيانات الأخصائيين والمشرفين
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:max-w-sm">
          <Label>اختر الأخصائي أو المشرف</Label>
          <Select value={specialistId} onValueChange={setSpecialistId}>
            <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
            <SelectContent>
              {specialists.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="sessions">الجلسات ({sessions.length})</TabsTrigger>
            <TabsTrigger value="appointments">المواعيد ({appointments.length})</TabsTrigger>
            <TabsTrigger value="cases">الحالات ({cases.length})</TabsTrigger>
            <TabsTrigger value="availability">التوافر</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-3">
            {(() => {
              const filtered = sessions.filter((s) => s.session_date >= fromDate && s.session_date <= toDate);
              const totalGross = filtered.reduce((sum, s) => sum + Number(s.cost), 0);
              const totalNet = filtered.reduce((sum, s) => {
                const d = Math.max(0, Math.min(100, Number(s.discount_percentage) || 0));
                return sum + Number(s.cost) * (1 - d / 100);
              }, 0);
              const totalShare = filtered.reduce((sum, s) => {
                const d = Math.max(0, Math.min(100, Number(s.discount_percentage) || 0));
                const net = Number(s.cost) * (1 - d / 100);
                return sum + (net * Number(s.specialist_percentage)) / 100;
              }, 0);
              const totalCenter = totalNet - totalShare;

              const esc = (v: any) => {
                const t = v == null ? "" : String(v);
                return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
              };
              const headers = ["التاريخ", "الوقت", "الحالة", "المدة", "السعر", "خصم%", "بعد الخصم", "نسبة الأخصائي%", "نصيب الأخصائي", "نصيب المركز", "طريقة الدفع", "ملاحظات"];
              const rowsCsv = filtered.map((s) => {
                const d = Math.max(0, Math.min(100, Number(s.discount_percentage) || 0));
                const net = Number(s.cost) * (1 - d / 100);
                const share = (net * Number(s.specialist_percentage)) / 100;
                return [
                  s.session_date, fmtTime12(s.session_time), s.case_name, s.duration_minutes,
                  Number(s.cost).toFixed(2), d + "%", net.toFixed(2),
                  s.specialist_percentage, share.toFixed(2), (net - share).toFixed(2),
                  s.payment_type === "monthly" ? "بالشهر" : "بالجلسة",
                  (s.notes || "").replace(/\n/g, " "),
                ].map(esc).join(",");
              });
              const totalRow = ["", "", "الإجمالي", filtered.length, totalGross.toFixed(2), "", totalNet.toFixed(2), "", totalShare.toFixed(2), totalCenter.toFixed(2), "", ""].map(esc).join(",");

              const downloadCsv = () => {
                const csv = "\uFEFF" + [headers.map(esc).join(","), ...rowsCsv, totalRow].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `جلسات-${specialistName}-${fromDate}_إلى_${toDate}.csv`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success("تم التنزيل");
              };

              const printSheet = () => {
                const bodyHtml = filtered.map((s) => {
                  const d = Math.max(0, Math.min(100, Number(s.discount_percentage) || 0));
                  const net = Number(s.cost) * (1 - d / 100);
                  const share = (net * Number(s.specialist_percentage)) / 100;
                  return `<tr>
                    <td>${s.session_date}</td>
                    <td>${fmtTime12(s.session_time)}</td>
                    <td>${s.case_name}</td>
                    <td>${s.duration_minutes}د</td>
                    <td>${Number(s.cost).toFixed(2)}</td>
                    <td>${d}%</td>
                    <td>${net.toFixed(2)}</td>
                    <td>${s.specialist_percentage}%</td>
                    <td>${share.toFixed(2)}</td>
                    <td>${(net - share).toFixed(2)}</td>
                  </tr>`;
                }).join("");
                const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
                  <title>سجل ${specialistName}</title>
                  <style>
                    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:18px;color:#111}
                    h1{margin:0 0 4px;font-size:18px}
                    .meta{color:#555;font-size:12px;margin-bottom:12px}
                    table{width:100%;border-collapse:collapse;font-size:12px}
                    th,td{border:1px solid #999;padding:5px 7px;text-align:center}
                    thead{background:#f0f0f0}
                    tfoot td{font-weight:bold;background:#fafafa}
                    .toolbar{margin:0 0 12px} .toolbar button{padding:6px 12px;cursor:pointer}
                    @media print{.noprint{display:none}}
                  </style></head><body>
                  <h1>سجل جلسات: ${specialistName}</h1>
                  <div class="meta">من ${fromDate} إلى ${toDate} · ${filtered.length} جلسة</div>
                  <div class="toolbar noprint"><button onclick="window.print()">طباعة</button></div>
                  <table>
                    <thead><tr>${["التاريخ","الوقت","الحالة","المدة","السعر","خصم","بعد الخصم","نسبة","نصيب الأخصائي","نصيب المركز"].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
                    <tbody>${bodyHtml || `<tr><td colspan="10">لا توجد بيانات</td></tr>`}</tbody>
                    <tfoot><tr>
                      <td colspan="6">الإجمالي (${filtered.length} جلسة)</td>
                      <td>${totalNet.toFixed(2)}</td>
                      <td>—</td>
                      <td>${totalShare.toFixed(2)}</td>
                      <td>${totalCenter.toFixed(2)}</td>
                    </tr></tfoot>
                  </table></body></html>`;
                const w = window.open("", "_blank");
                if (!w) return toast.error("فعّل النوافذ المنبثقة");
                w.document.write(html); w.document.close();
              };

              return (
                <>
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">من تاريخ</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-40" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">إلى تاريخ</Label>
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-40" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setFromDate(monthStart()); setToDate(today()); }}>هذا الشهر</Button>
                    <Button size="sm" variant="outline" onClick={() => { const t = today(); setFromDate(t); setToDate(t); }}>اليوم</Button>
                    <div className="flex-1" />
                    <Button size="sm" variant="outline" onClick={downloadCsv} disabled={filtered.length === 0}>
                      <Download className="h-4 w-4 ml-1" /> تنزيل CSV
                    </Button>
                    <Button size="sm" variant="secondary" onClick={printSheet} disabled={filtered.length === 0}>
                      <Printer className="h-4 w-4 ml-1" /> طباعة
                    </Button>
                    <Button size="sm" onClick={() => openCreate("session")} disabled={!specialistId}>
                      <Plus className="h-4 w-4" /> إضافة جلسة
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-muted-foreground">عدد الجلسات</div>
                      <div className="font-bold text-base">{filtered.length}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-muted-foreground">الإجمالي (بعد الخصم)</div>
                      <div className="font-bold text-base">{totalNet.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md border bg-primary/10 p-2">
                      <div className="text-muted-foreground">نصيب الأخصائي</div>
                      <div className="font-bold text-base text-primary">{totalShare.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-muted-foreground">نصيب المركز</div>
                      <div className="font-bold text-base">{totalCenter.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>الوقت</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>المدة</TableHead>
                          <TableHead>التكلفة</TableHead>
                          <TableHead>%</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد جلسات في النطاق المحدد</TableCell></TableRow>
                        ) : filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.session_date}</TableCell>
                            <TableCell>{r.session_time.slice(0,5)}</TableCell>
                            <TableCell>{r.case_name}</TableCell>
                            <TableCell>{r.duration_minutes}د</TableCell>
                            <TableCell>{r.cost}</TableCell>
                            <TableCell>{r.specialist_percentage}%</TableCell>
                            <TableCell className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit("session", r)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => removeSession(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </TabsContent>


          <TabsContent value="appointments" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">مواعيد {specialistName}</p>
              <p className="text-xs text-muted-foreground">إضافة المواعيد الجديدة تتم من ملف الحالة فقط</p>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوقت</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الوضع</TableHead>
                    <TableHead>المدة</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                  ) : appointments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                  ) : appointments.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.scheduled_date}</TableCell>
                      <TableCell>{r.scheduled_time.slice(0,5)}</TableCell>
                      <TableCell>{r.case_name}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.duration_minutes}د</TableCell>
                      <TableCell>{r.cost ?? "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit("appointment", r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeAppointment(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cases" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">حالات {specialistName}</p>
              <Button size="sm" onClick={() => openCreate("case")} disabled={!specialistId}>
                <Plus className="h-4 w-4" /> إضافة حالة
              </Button>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الوقت</TableHead>
                    <TableHead>المدة</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                  ) : cases.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                  ) : cases.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.recurring_time.slice(0,5)}</TableCell>
                      <TableCell>{r.default_duration_minutes}د</TableCell>
                      <TableCell>{r.default_cost}</TableCell>
                      <TableCell>{r.default_specialist_percentage}%</TableCell>
                      <TableCell>{r.active ? "نشطة" : "متوقفة"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit("case", r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeCase(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="availability" className="space-y-3">
            <p className="text-sm text-muted-foreground">ساعات عمل {specialistName} الأسبوعية</p>
            <AvailabilityEditor specialistId={specialistId} />
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editKind} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "إضافة" : "تعديل"} {editKind === "session" ? "جلسة" : editKind === "appointment" ? "موعد" : "حالة"}
            </DialogTitle>
          </DialogHeader>
          {editData && editKind === "session" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسم الحالة"><Input value={editData.case_name} onChange={(e) => setField("case_name", e.target.value)} /></Field>
              <Field label="التاريخ"><Input type="date" value={editData.session_date} onChange={(e) => setField("session_date", e.target.value)} /></Field>
              <Field label="الوقت"><Input type="time" value={editData.session_time?.slice(0,5)} onChange={(e) => setField("session_time", e.target.value)} /></Field>
              <Field label="المدة (دقيقة)"><Input type="number" value={editData.duration_minutes} onChange={(e) => setField("duration_minutes", e.target.value)} /></Field>
              <Field label="التكلفة"><Input type="number" value={editData.cost} onChange={(e) => setField("cost", e.target.value)} /></Field>
              <Field label="نسبة الأخصائي %"><Input type="number" value={editData.specialist_percentage} onChange={(e) => setField("specialist_percentage", e.target.value)} /></Field>
              <Field label="خصم %"><Input type="number" value={editData.discount_percentage} onChange={(e) => setField("discount_percentage", e.target.value)} /></Field>
              <Field label="ملاحظات" full><Textarea value={editData.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></Field>
            </div>
          )}
          {editData && editKind === "appointment" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسم الحالة"><Input value={editData.case_name} onChange={(e) => setField("case_name", e.target.value)} /></Field>
              <Field label="واتساب"><Input value={editData.case_whatsapp || ""} onChange={(e) => setField("case_whatsapp", e.target.value)} /></Field>
              <Field label="التاريخ"><Input type="date" value={editData.scheduled_date} onChange={(e) => setField("scheduled_date", e.target.value)} /></Field>
              <Field label="الوقت"><Input type="time" value={editData.scheduled_time?.slice(0,5)} onChange={(e) => setField("scheduled_time", e.target.value)} /></Field>
              <Field label="المدة"><Input type="number" value={editData.duration_minutes} onChange={(e) => setField("duration_minutes", e.target.value)} /></Field>
              <Field label="التكلفة"><Input type="number" value={editData.cost ?? 0} onChange={(e) => setField("cost", e.target.value)} /></Field>
              <Field label="نسبة الأخصائي %"><Input type="number" value={editData.specialist_percentage} onChange={(e) => setField("specialist_percentage", e.target.value)} /></Field>
              <Field label="خصم %"><Input type="number" value={editData.discount_percentage} onChange={(e) => setField("discount_percentage", e.target.value)} /></Field>
              <Field label="الوضع">
                <Select value={editData.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">مجدول</SelectItem>
                    <SelectItem value="attended">حضر</SelectItem>
                    <SelectItem value="apologized">اعتذر</SelectItem>
                    <SelectItem value="absent">غاب</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="نوع الجلسة">
                <Select value={editData.session_kind} onValueChange={(v) => setField("session_kind", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">عادية</SelectItem>
                    <SelectItem value="initial_assessment">تقييم مبدئي</SelectItem>
                    <SelectItem value="test">اختبار</SelectItem>
                    <SelectItem value="periodic_assessment">تقييم دوري</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ملاحظات" full><Textarea value={editData.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></Field>
            </div>
          )}
          {editData && editKind === "case" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسم الحالة"><Input value={editData.name} onChange={(e) => setField("name", e.target.value)} /></Field>
              <Field label="واتساب"><Input value={editData.whatsapp || ""} onChange={(e) => setField("whatsapp", e.target.value)} /></Field>
              <Field label="وقت الجلسة"><Input type="time" value={editData.recurring_time?.slice(0,5)} onChange={(e) => setField("recurring_time", e.target.value)} /></Field>
              <Field label="المدة الافتراضية"><Input type="number" value={editData.default_duration_minutes} onChange={(e) => setField("default_duration_minutes", e.target.value)} /></Field>
              <Field label="التكلفة الافتراضية"><Input type="number" value={editData.default_cost} onChange={(e) => setField("default_cost", e.target.value)} /></Field>
              <Field label="نسبة الأخصائي %"><Input type="number" value={editData.default_specialist_percentage} onChange={(e) => setField("default_specialist_percentage", e.target.value)} /></Field>
              <Field label="خصم %"><Input type="number" value={editData.discount_percentage} onChange={(e) => setField("discount_percentage", e.target.value)} /></Field>
              <Field label="نشطة">
                <Select value={String(editData.active)} onValueChange={(v) => setField("active", v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">نشطة</SelectItem>
                    <SelectItem value="false">متوقفة</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="أيام الأسبوع (0=أحد، 6=سبت، مفصولة بفاصلة)" full>
                <Input
                  value={(editData.recurring_days || []).join(",")}
                  onChange={(e) => setField("recurring_days", e.target.value.split(",").map((x: string) => Number(x.trim())).filter((n: number) => !isNaN(n) && n >= 0 && n <= 6))}
                />
              </Field>
              <Field label="ملاحظات" full><Textarea value={editData.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={saveDialog}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`grid gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
