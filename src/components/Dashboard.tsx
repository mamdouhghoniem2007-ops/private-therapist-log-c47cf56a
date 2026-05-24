import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Clock, DollarSign, TrendingUp, CalendarDays, Shield, Users, CalendarPlus, CalendarClock, UserCog, Download, MessageCircle } from "lucide-react";
import { waLink, formatAppointmentMessage } from "@/lib/whatsapp";
import logo from "@/assets/logo.png";
import { AttendanceCard } from "@/components/AttendanceCard";
import { CasesCard } from "@/components/CasesCard";
import { EmployeesCard } from "@/components/EmployeesCard";

type SessionKind = "regular" | "initial_assessment" | "test" | "periodic_assessment";
const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  regular: "جلسة عادية",
  initial_assessment: "تقييم مبدئي",
  test: "اختبار",
  periodic_assessment: "تقييم دوري",
};
const SESSION_KINDS: SessionKind[] = ["regular", "initial_assessment", "test", "periodic_assessment"];

type Role = "admin" | "supervisor" | "specialist";

type Session = {
  id: string;
  specialist_id: string;
  case_name: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  cost: number;
  specialist_percentage: number;
  session_type: string | null;
  test_type: string | null;
  notes: string | null;

};

type Appointment = {
  id: string;
  specialist_id: string;
  case_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  session_type: string | null;
  test_type: string | null;
  cost: number | null;
  specialist_percentage: number;
  notes: string | null;
  case_whatsapp: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  session_kind: SessionKind;
  case_id: string | null;
};

type Profile = { id: string; full_name: string };
type RoleRow = { user_id: string; role: Role };

const today = () => new Date().toISOString().slice(0, 10);

const DURATION_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
const PERCENTAGE_OPTIONS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const TESTS_LABEL = "اختبارات";
const SESSION_TYPES = ["تخاطب", "تأهيل", "تأسيس أكاديمي", "تعديل سلوك", "تنمية مهارات", "صعوبات تعلم", "علاج وظيفي", "تقييم", TESTS_LABEL];
const TEST_TYPES = [
  "IQ ستانفورد بينيه",
  "وكسلر للأطفال",
  "مقياس جيليام للتوحد (GARS)",
  "بورتاج للنمو",
  "فاينلاند للسلوك التكيفي",
  "اختبار اللغة",
  "اختبار فرط الحركة وتشتت الانتباه (ADHD)",
  "مقياس فرص الانتباه (Conners)",
  "اختبار صعوبات التعلم",
  "تقييم النطق والكلام",
];
const ROLE_LABEL: Record<Role, string> = { admin: "مدير", supervisor: "مشرف", specialist: "أخصائي" };


export function Dashboard({ user }: { user: User }) {
  const [profileName, setProfileName] = useState<string>("");
  const [role, setRole] = useState<Role>("specialist");
  const [roleReady, setRoleReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [specialists, setSpecialists] = useState<Profile[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [allRoles, setAllRoles] = useState<Record<string, Role>>({});
  const [filterDate, setFilterDate] = useState(today());
  const [loading, setLoading] = useState(true);

  // session form (specialist)
  const [caseName, setCaseName] = useState("");
  const [sDate, setSDate] = useState(today());
  const [sTime, setSTime] = useState("10:00");
  const [duration, setDuration] = useState(45);
  const [sType, setSType] = useState(SESSION_TYPES[0]);
  const [sTestType, setSTestType] = useState(TEST_TYPES[0]);
  const [cost, setCost] = useState<number | "">("");
  const [percentage, setPercentage] = useState(50);
  const [sNotes, setSNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // appointment form (admin / supervisor)
  const [aSpecialist, setASpecialist] = useState<string>("");
  const [aCase, setACase] = useState("");
  const [aDate, setADate] = useState(today());
  const [aTime, setATime] = useState("10:00");
  const [aDuration, setADuration] = useState(45);
  const [aType, setAType] = useState(SESSION_TYPES[0]);
  const [aTestType, setATestType] = useState(TEST_TYPES[0]);
  const [aCost, setACost] = useState<number | "">("");
  const [aPercentage, setAPercentage] = useState(50);
  const [aNotes, setANotes] = useState("");
  const [aCaseWhatsapp, setACaseWhatsapp] = useState("");
  const [aSessionKind, setASessionKind] = useState<SessionKind>("regular");
  const [aSubmitting, setASubmitting] = useState(false);


  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isSpecialist = role === "specialist";
  const canManageSchedule = isAdmin || isSupervisor;

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setProfileName(prof?.full_name || user.email || "");
      const list = (roles || []).map((r: any) => r.role as Role);
      const resolved: Role = list.includes("admin") ? "admin" : list.includes("supervisor") ? "supervisor" : "specialist";
      setRole(resolved);
      setRoleReady(true);
    })();
  }, [user.id, user.email]);

  const loadAll = async () => {
    setLoading(true);
    const [sessionsRes, apptsRes] = await Promise.all([
      supabase.from("sessions").select("*").order("session_date", { ascending: false }).order("session_time", { ascending: false }),
      supabase.from("appointments").select("*").order("scheduled_date", { ascending: false }).order("scheduled_time"),
    ]);
    if (sessionsRes.error && !isSupervisor) toast.error(sessionsRes.error.message);
    setSessions((sessionsRes.data as Session[]) || []);
    if (apptsRes.error) toast.error(apptsRes.error.message);
    else setAppointments((apptsRes.data as Appointment[]) || []);

    if (canManageSchedule) {
      const [{ data: profs }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        isAdmin ? supabase.from("user_roles").select("user_id, role") : Promise.resolve({ data: [] as RoleRow[] }),
      ]);
      const list = (profs as Profile[] | null) || [];
      const map: Record<string, string> = {};
      list.forEach((p) => (map[p.id] = p.full_name));
      setProfilesMap(map);

      // Only "specialist" users should be listed in the appointment dropdown
      const rolesMap: Record<string, Role> = {};
      ((rolesData as RoleRow[] | null) || []).forEach((r) => {
        // last one wins; only admin sees this data
        if (!rolesMap[r.user_id] || r.role === "admin") rolesMap[r.user_id] = r.role;
      });
      setAllRoles(rolesMap);

      const specialistsOnly = isAdmin
        ? list.filter((p) => (rolesMap[p.id] || "specialist") === "specialist")
        : list.filter((p) => p.id !== user.id); // supervisor: assume non-self; backend RLS doesn't allow them to read roles
      setSpecialists(specialistsOnly);
      if (!aSpecialist && specialistsOnly.length) setASpecialist(specialistsOnly[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { if (roleReady) loadAll(); /* eslint-disable-next-line */ }, [roleReady, role]);

  const addSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cost === "" || cost < 0) return toast.error("أدخل تكلفة صحيحة");
    setSubmitting(true);
    const { error } = await supabase.from("sessions").insert({
      specialist_id: user.id,
      case_name: caseName.trim(),
      session_date: sDate,
      session_time: sTime,
      duration_minutes: duration,
      cost: Number(cost),
      specialist_percentage: percentage,
      session_type: sType,
      test_type: sType === TESTS_LABEL ? sTestType : null,
      notes: sNotes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const savedName = caseName.trim();
    const typeLabel = sType === TESTS_LABEL ? `${sType} - ${sTestType}` : sType;
    toast.success("تم تسجيل الجلسة بنجاح ✅", {
      description: `الحالة: ${savedName} · ${typeLabel} · ${sDate} الساعة ${sTime} · ${duration} دقيقة · التكلفة ${Number(cost).toFixed(2)}`,
      duration: 6000,
    });
    setCaseName(""); setCost(""); setSNotes("");
    loadAll();
  };


  const addAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aSpecialist) return toast.error("اختر الأخصائي");
    setASubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      specialist_id: aSpecialist,
      case_name: aCase.trim(),
      scheduled_date: aDate,
      scheduled_time: aTime,
      duration_minutes: aDuration,
      session_type: aType,
      test_type: aType === TESTS_LABEL ? aTestType : null,
      cost: aCost === "" ? null : Number(aCost),
      specialist_percentage: aPercentage,
      notes: aNotes.trim() || null,
      case_whatsapp: aCaseWhatsapp.trim() || null,
      session_kind: aSessionKind,
      created_by: user.id,
    });
    setASubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة الموعد للجدول");
    setACase(""); setANotes(""); setACost(""); setACaseWhatsapp(""); setASessionKind("regular");
    loadAll();
  };

  const markAppointmentCancelled = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    const appt = appointments.find((x) => x.id === id);
    toast.success("تم تسجيل اعتذار الحالة", {
      description: appt ? `${appt.case_name} · ${appt.scheduled_date} ${appt.scheduled_time.slice(0,5)}` : undefined,
      duration: 6000,
    });
  };

  const removeAppointment = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((a) => a.filter((x) => x.id !== id));
    toast.success("تم حذف الموعد");
  };

  const startAppointment = async (id: string) => {
    const now = new Date().toISOString();
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, started_at: now } : x)));
    const { error } = await supabase.from("appointments").update({ started_at: now }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("تم تسجيل بداية الجلسة");
  };

  const endAppointment = async (id: string) => {
    const now = new Date().toISOString();
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, ended_at: now } : x)));
    const { error } = await supabase.from("appointments").update({ ended_at: now }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("تم تسجيل نهاية الجلسة");
  };

  const updateAppointmentCost = async (id: string, value: number) => {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, cost: value } : x)));
    const { error } = await supabase.from("appointments").update({ cost: value }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const updateAppointmentPercentage = async (id: string, value: number) => {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, specialist_percentage: value } : x)));
    const { error } = await supabase.from("appointments").update({ specialist_percentage: value }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const useAppointment = (a: Appointment) => {
    setCaseName(a.case_name);
    setSDate(a.scheduled_date);
    setSTime(a.scheduled_time.slice(0, 5));
    setDuration(a.duration_minutes);
    if (a.session_type) setSType(a.session_type);
    if (a.test_type) setSTestType(a.test_type);
    if (a.cost != null) setCost(Number(a.cost));
    if (a.specialist_percentage != null) setPercentage(Number(a.specialist_percentage));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeSession = async (id: string) => {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSessions((s) => s.filter((x) => x.id !== id));
    toast.success("تم الحذف");
  };

  const updatePercentage = async (id: string, value: number) => {
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, specialist_percentage: value } : x)));
    const { error } = await supabase.from("sessions").update({ specialist_percentage: value }).eq("id", id);
    if (error) toast.error(error.message);
  };


  // Admin role management
  const changeUserRole = async (userId: string, newRole: Role) => {
    if (userId === user.id) return toast.error("لا يمكنك تغيير دورك بنفسك");
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) return toast.error(insErr.message);
    setAllRoles((r) => ({ ...r, [userId]: newRole }));
    toast.success(`تم تعيين الدور: ${ROLE_LABEL[newRole]}`);
  };

  const dayRows = useMemo(() => sessions.filter((s) => s.session_date === filterDate), [sessions, filterDate]);
  const myDayAppointments = useMemo(
    () => appointments.filter((a) => a.specialist_id === user.id && a.scheduled_date === filterDate),
    [appointments, user.id, filterDate],
  );
  const allDayAppointments = useMemo(
    () => appointments.filter((a) => a.scheduled_date === filterDate),
    [appointments, filterDate],
  );

  const adminGroups = useMemo(() => {
    if (!isAdmin) return [];
    const groups: Record<string, { name: string; rows: Session[]; total: number; share: number; center: number }> = {};
    for (const s of dayRows) {
      const k = s.specialist_id;
      if (!groups[k]) groups[k] = { name: profilesMap[k] || "—", rows: [], total: 0, share: 0, center: 0 };
      groups[k].rows.push(s);
      const cost = Number(s.cost);
      const share = (cost * Number(s.specialist_percentage)) / 100;
      groups[k].total += cost;
      groups[k].share += share;
      groups[k].center += cost - share;
    }
    return Object.entries(groups).map(([id, g]) => ({ id, ...g }));
  }, [isAdmin, dayRows, profilesMap]);

  const totals = useMemo(() => {
    const totalCost = dayRows.reduce((sum, s) => sum + Number(s.cost), 0);
    const specialistShare = dayRows.reduce((sum, s) => sum + (Number(s.cost) * Number(s.specialist_percentage)) / 100, 0);
    return { totalCost, specialistShare, centerShare: totalCost - specialistShare, count: dayRows.length };
  }, [dayRows]);

  const allUsersForRoles = useMemo(() => {
    return Object.entries(profilesMap)
      .filter(([id]) => id !== user.id)
      .map(([id, name]) => ({ id, name, role: (allRoles[id] || "specialist") as Role }));
  }, [profilesMap, allRoles, user.id]);

  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const triggerDownload = (filename: string, csv: string) => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const fmtT = (ts: string | null | undefined) =>
    ts ? new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "";

  // Map appointment start/end to a session via (specialist_id + case_name + date)
  const apptMap = useMemo(() => {
    const m: Record<string, Appointment> = {};
    for (const a of appointments) m[`${a.specialist_id}|${a.case_name}|${a.scheduled_date}`] = a;
    return m;
  }, [appointments]);

  const sessionRowCsv = (s: Session) => {
    const cost = Number(s.cost);
    const share = (cost * Number(s.specialist_percentage)) / 100;
    const a = apptMap[`${s.specialist_id}|${s.case_name}|${s.session_date}`];
    return [
      s.session_date,
      s.session_time?.slice(0, 5) || "",
      fmtT(a?.started_at),
      fmtT(a?.ended_at),
      profilesMap[s.specialist_id] || (s.specialist_id === user.id ? profileName : "—"),
      s.case_name,
      s.session_type || "",
      s.test_type || "",
      s.duration_minutes,
      cost.toFixed(2),
      s.specialist_percentage,
      share.toFixed(2),
      (cost - share).toFixed(2),
      (s.notes || "").replace(/\n/g, " "),
    ].map(esc).join(",");
  };
  const sessionHeaders = ["التاريخ", "الوقت المجدول", "بداية الجلسة", "نهاية الجلسة", "الأخصائي", "اسم الحالة", "نوع الجلسة", "نوع الاختبار", "المدة (دقيقة)", "التكلفة", "نسبة الأخصائي %", "نصيب الأخصائي", "نصيب المركز", "ملاحظات"];

  const downloadDailySheet = () => {
    const rows = dayRows.map(sessionRowCsv);
    const totalRow = ["", "", "", "", "", "", "", "", "الإجمالي", totals.totalCost.toFixed(2), "", totals.specialistShare.toFixed(2), totals.centerShare.toFixed(2), ""].map(esc).join(",");
    triggerDownload(`جلسات-${filterDate}.csv`, [sessionHeaders.map(esc).join(","), ...rows, totalRow].join("\n"));
    toast.success("تم تنزيل الشيت اليومي");
  };

  const downloadMonthlySheet = async () => {
    const [y, m] = filterDate.split("-").map(Number);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sessions").select("*")
      .gte("session_date", first).lte("session_date", last)
      .order("session_date").order("session_time");
    if (error) return toast.error(error.message);
    const monthRows = ((data as Session[]) || []);
    const rows = monthRows.map(sessionRowCsv);
    const totalCost = monthRows.reduce((sum, s) => sum + Number(s.cost), 0);
    const specShare = monthRows.reduce((sum, s) => sum + (Number(s.cost) * Number(s.specialist_percentage)) / 100, 0);
    const totalRow = ["", "", "", "", "", "", "", "", "الإجمالي", totalCost.toFixed(2), "", specShare.toFixed(2), (totalCost - specShare).toFixed(2), ""].map(esc).join(",");

    // Summary per specialist
    const sum: Record<string, { name: string; count: number; total: number; share: number }> = {};
    for (const s of monthRows) {
      const name = profilesMap[s.specialist_id] || (s.specialist_id === user.id ? profileName : "—");
      if (!sum[s.specialist_id]) sum[s.specialist_id] = { name, count: 0, total: 0, share: 0 };
      const c = Number(s.cost);
      sum[s.specialist_id].count += 1;
      sum[s.specialist_id].total += c;
      sum[s.specialist_id].share += (c * Number(s.specialist_percentage)) / 100;
    }
    const sumLines = [
      ["الأخصائي", "عدد الجلسات", "الإجمالي", "نصيب الأخصائي", "نصيب المركز"].map(esc).join(","),
      ...Object.values(sum).map((g) => [g.name, g.count, g.total.toFixed(2), g.share.toFixed(2), (g.total - g.share).toFixed(2)].map(esc).join(",")),
    ];

    const csv = [
      `ملخص شهر ${y}-${String(m).padStart(2, "0")}`,
      ...sumLines,
      "",
      "التفاصيل",
      sessionHeaders.map(esc).join(","),
      ...rows,
      totalRow,
    ].join("\n");
    triggerDownload(`جلسات-${y}-${String(m).padStart(2, "0")}.csv`, csv);
    toast.success("تم تنزيل الشيت الشهري");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="مركز رعاية" className="h-12 w-auto" />
            <div>
              <p className="font-bold text-primary leading-tight">مركز رعاية</p>
              <p className="text-[11px] text-accent-foreground leading-tight">للتخاطب والتأهيل</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                {(isAdmin || isSupervisor) && <Shield className="h-3 w-3 text-primary" />}
                {ROLE_LABEL[role]}
              </p>
              <p className="text-sm font-semibold leading-tight">{profileName}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* ========= SPECIALIST ========= */}
        {isSpecialist && (
          <>
            <Card className="shadow-[var(--shadow-card)] border-accent/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarClock className="h-5 w-5 text-accent-foreground" />
                  جدولي ليوم {filterDate}
                  <span className="text-xs text-muted-foreground font-normal">({myDayAppointments.length} موعد)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myDayAppointments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">لا توجد مواعيد في هذا اليوم</p>
                ) : (
                  <div className="space-y-2">
                    {myDayAppointments.map((a) => (
                      <AppointmentRow
                        key={a.id}
                        a={a}
                        actionLabel="تسجيل"
                        onAction={() => useAppointment(a)}
                        onStart={() => startAppointment(a.id)}
                        onEnd={() => endAppointment(a.id)}
                        onCancel={a.status !== "cancelled" ? () => markAppointmentCancelled(a.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5 text-primary" />
                  تسجيل جلسة جديدة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addSession} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-2 lg:col-span-2">
                    <Label>اسم الحالة</Label>
                    <Input required value={caseName} onChange={(e) => setCaseName(e.target.value)} placeholder="مثال: أحمد م." />
                  </div>
                  <div className="space-y-2">
                    <Label>نوع الجلسة</Label>
                    <Select value={sType} onValueChange={setSType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {sType === TESTS_LABEL && (
                    <div className="space-y-2 lg:col-span-2">
                      <Label>نوع الاختبار</Label>
                      <Select value={sTestType} onValueChange={setSTestType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    <Input type="date" required value={sDate} onChange={(e) => setSDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>الوقت</Label>
                    <Input type="time" required value={sTime} onChange={(e) => setSTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>المدة</Label>
                    <Select value={String(duration)} onValueChange={(v) => setDuration(+v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} دقيقة</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>التكلفة</Label>
                    <Input type="number" min={0} step="0.01" required value={cost} onChange={(e) => setCost(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>نسبة الأخصائي</Label>
                    <Select value={String(percentage)} onValueChange={(v) => setPercentage(+v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERCENTAGE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-6">
                    <Label>ما تم خلال الجلسة</Label>
                    <Textarea
                      value={sNotes}
                      onChange={(e) => setSNotes(e.target.value)}
                      placeholder="اكتب باختصار ما تم مع الحالة خلال الجلسة (الأنشطة، الملاحظات، التقدم...)"
                      rows={3}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-6 flex items-end">
                    <Button type="submit" disabled={submitting} className="w-full lg:w-auto">
                      {submitting ? "جارٍ الحفظ..." : "إضافة الجلسة"}
                    </Button>
                  </div>

                </form>
              </CardContent>
            </Card>
          </>
        )}

        {/* ========= ADMIN / SUPERVISOR: schedule manager ========= */}
        {canManageSchedule && (
          <Card className="shadow-[var(--shadow-card)] border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarPlus className="h-5 w-5 text-primary" />
                إضافة موعد لجدول أخصائي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addAppointment} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label>الأخصائي</Label>
                  <Select value={aSpecialist} onValueChange={setASpecialist}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {specialists.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>اسم الحالة</Label>
                  <Input required value={aCase} onChange={(e) => setACase(e.target.value)} placeholder="مثال: أحمد م." />
                </div>
                <div className="space-y-2">
                  <Label>نوع الجلسة</Label>
                  <Select value={aType} onValueChange={setAType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {aType === TESTS_LABEL && (
                  <div className="space-y-2 lg:col-span-2">
                    <Label>نوع الاختبار</Label>
                    <Select value={aTestType} onValueChange={setATestType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input type="date" required value={aDate} onChange={(e) => setADate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>الوقت</Label>
                  <Input type="time" required value={aTime} onChange={(e) => setATime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>المدة</Label>
                  <Select value={String(aDuration)} onValueChange={(v) => setADuration(+v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} دقيقة</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <>
                    <div className="space-y-2">
                      <Label>تكلفة الجلسة (ما يدفعه الطفل)</Label>
                      <Input type="number" min={0} step="0.01" value={aCost} onChange={(e) => setACost(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>نسبة الأخصائي</Label>
                      <Select value={String(aPercentage)} onValueChange={(v) => setAPercentage(+v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERCENTAGE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>تصنيف الجلسة</Label>
                  <Select value={aSessionKind} onValueChange={(v) => setASessionKind(v as SessionKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_KINDS.map((k) => <SelectItem key={k} value={k}>{SESSION_KIND_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>رقم WhatsApp للحالة</Label>
                  <Input value={aCaseWhatsapp} onChange={(e) => setACaseWhatsapp(e.target.value)} placeholder="+201234567890" dir="ltr" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input value={aNotes} onChange={(e) => setANotes(e.target.value)} placeholder="..." />
                </div>
                <div className="lg:col-span-2 flex items-end">
                  <Button type="submit" disabled={aSubmitting} className="w-full lg:w-auto">
                    {aSubmitting ? "جارٍ الحفظ..." : "إضافة للجدول"}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
        )}

        {/* Date filter + counters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <Label className="text-sm">عرض يوم:</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-auto" />
            {isAdmin && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={downloadDailySheet} disabled={dayRows.length === 0}>
                  <Download className="h-4 w-4 ml-1" />
                  شيت اليوم
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={downloadMonthlySheet}>
                  <Download className="h-4 w-4 ml-1" />
                  شيت الشهر
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {canManageSchedule && `${allDayAppointments.length} موعد`}
            {isAdmin && ` · ${totals.count} جلسة مسجَّلة · ${adminGroups.length} أخصائي`}
            {isSpecialist && `${totals.count} جلسة مسجَّلة`}
          </p>
        </div>

        {/* Stats — admin and specialist only (supervisor has no financial access) */}
        {(isAdmin || isSpecialist) && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="إجمالي اليوم" value={totals.totalCost} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label={isAdmin ? "نصيب الأخصائيين" : "نصيبك"} value={totals.specialistShare} highlight />
            <StatCard icon={<Clock className="h-5 w-5" />} label="نصيب المركز" value={totals.centerShare} />
          </div>
        )}

        {/* Schedule view for admin/supervisor */}
        {canManageSchedule && (
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                جدول اليوم
                <span className="text-xs text-muted-foreground font-normal">({allDayAppointments.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allDayAppointments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مواعيد في هذا اليوم</p>
              ) : (
                <div className="space-y-2">
                  {allDayAppointments.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      a={a}
                      subtitle={profilesMap[a.specialist_id] || "—"}
                      onRemove={() => removeAppointment(a.id)}
                      onCostChange={isAdmin ? (v) => updateAppointmentCost(a.id, v) : undefined}
                      onPercentageChange={isAdmin ? (v) => updateAppointmentPercentage(a.id, v) : undefined}
                      hideFinancial={isSupervisor}
                    />
                  ))}

                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Attendance — all roles */}
        {/* Cases — admin/supervisor manage, specialists see own */}
        <CasesCard user={user} role={role} specialists={specialists} profilesMap={profilesMap} />

        {/* Attendance — all roles */}
        <AttendanceCard user={user} role={role} profilesMap={profilesMap} allRoles={allRoles} />



        {/* Admin: employees management (add / edit / delete) */}
        {isAdmin && <EmployeesCard currentUserId={user.id} onChanged={loadAll} />}

        {/* Sessions — admin (grouped) or specialist (own) */}
        {!isSupervisor && (
          loading ? (
            <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p>
          ) : dayRows.length === 0 ? (
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="py-12 text-center text-muted-foreground">لا توجد جلسات مسجَّلة في هذا اليوم</CardContent>
            </Card>
          ) : isAdmin ? (
            <div className="space-y-4">
              {adminGroups.map((g) => (
                <Card key={g.id} className="shadow-[var(--shadow-card)]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {g.name}
                        <span className="text-xs text-muted-foreground font-normal">({g.rows.length} جلسة)</span>
                      </span>
                      <span className="flex gap-4 text-xs font-normal">
                        <span>إجمالي: <b>{g.total.toFixed(2)}</b></span>
                        <span className="text-primary">نصيبه: <b>{g.share.toFixed(2)}</b></span>
                        <span className="text-muted-foreground">المركز: <b>{g.center.toFixed(2)}</b></span>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SessionsTable rows={g.rows} onPercentage={updatePercentage} onRemove={removeSession} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader><CardTitle className="text-lg">الجلسات المسجَّلة</CardTitle></CardHeader>
              <CardContent>
                <SessionsTable rows={dayRows} onPercentage={updatePercentage} onRemove={removeSession} totals={totals} />
              </CardContent>
            </Card>
          )
        )}
      </main>
    </div>
  );
}

function AppointmentRow({
  a, subtitle, actionLabel, onAction, onRemove, onCancel, onCostChange, onPercentageChange, hideFinancial, onStart, onEnd,
}: {
  a: Appointment;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRemove?: () => void;
  onCancel?: () => void;
  onCostChange?: (v: number) => void;
  onPercentageChange?: (v: number) => void;
  hideFinancial?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  const [costDraft, setCostDraft] = useState<string>(a.cost != null ? String(a.cost) : "");
  useEffect(() => { setCostDraft(a.cost != null ? String(a.cost) : ""); }, [a.cost]);
  const share = a.cost != null ? (Number(a.cost) * Number(a.specialist_percentage)) / 100 : null;
  const isCancelled = a.status === "cancelled";
  const fmtT = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : null;
  const startedTxt = fmtT(a.started_at);
  const endedTxt = fmtT(a.ended_at);
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap ${isCancelled ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}>{a.case_name}</span>
          {isCancelled && <span className="text-xs rounded bg-destructive/15 px-2 py-0.5 text-destructive font-semibold">اعتذرت</span>}
          {a.session_kind && a.session_kind !== "regular" && (
            <span className="text-xs rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 font-semibold">
              {a.session_kind === "initial_assessment" ? "تقييم مبدئي" : a.session_kind === "test" ? "اختبار" : "تقييم دوري"}
            </span>
          )}
          {startedTxt && !endedTxt && <span className="text-xs rounded bg-primary/15 px-2 py-0.5 text-primary font-semibold">جارية</span>}
          {endedTxt && <span className="text-xs rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-600 font-semibold">منتهية</span>}
          {a.session_type && <span className="text-xs rounded bg-accent/20 px-2 py-0.5 text-accent-foreground">{a.session_type}</span>}
          {a.test_type && <span className="text-xs rounded bg-primary/15 px-2 py-0.5 text-primary">{a.test_type}</span>}
          {subtitle && <span className="text-xs text-muted-foreground">— {subtitle}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1" dir="ltr">
          {a.scheduled_time.slice(0, 5)} · {a.duration_minutes} د
          {startedTxt && <span dir="rtl"> · بدأت: {startedTxt}</span>}
          {endedTxt && <span dir="rtl"> · انتهت: {endedTxt}</span>}
          {!hideFinancial && a.cost != null && !onCostChange && <span dir="rtl"> · تكلفة: {Number(a.cost).toFixed(2)}</span>}
          {!hideFinancial && !onPercentageChange && <span dir="rtl"> · نسبة: {a.specialist_percentage}%</span>}
          {!hideFinancial && share != null && <span dir="rtl"> · نصيب الأخصائي: {share.toFixed(2)}</span>}
          {a.notes && <span dir="rtl"> · {a.notes}</span>}
        </p>
      </div>
      {onCostChange && (
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">تكلفة</Label>
          <Input
            type="number" min={0} step="0.01"
            className="h-8 w-24"
            value={costDraft}
            onChange={(e) => setCostDraft(e.target.value)}
            onBlur={() => {
              const v = costDraft === "" ? NaN : Number(costDraft);
              if (!Number.isNaN(v) && v !== Number(a.cost)) onCostChange(v);
            }}
          />
        </div>
      )}
      {onPercentageChange && (
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">نسبة</Label>
          <Select value={String(a.specialist_percentage)} onValueChange={(v) => onPercentageChange(+v)}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERCENTAGE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {onStart && !isCancelled && !a.started_at && (
        <Button size="sm" variant="default" onClick={onStart}>بدء الجلسة</Button>
      )}
      {onEnd && !isCancelled && a.started_at && !a.ended_at && (
        <Button size="sm" variant="secondary" onClick={onEnd}>إنهاء الجلسة</Button>
      )}
      {actionLabel && onAction && !isCancelled && (
        <Button size="sm" variant="outline" onClick={onAction}>{actionLabel}</Button>
      )}
      {onCancel && !isCancelled && (
        <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onCancel}>
          اعتذرت اليوم
        </Button>
      )}
      {onRemove && (
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}


function SessionsTable({
  rows, onPercentage, onRemove, totals,
}: {
  rows: Session[];
  onPercentage: (id: string, v: number) => void;
  onRemove: (id: string) => void;
  totals?: { totalCost: number; specialistShare: number };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-right text-muted-foreground">
          <tr>
            <th className="py-3 pr-2 font-medium">الحالة</th>
            <th className="py-3 px-2 font-medium">النوع</th>
            <th className="py-3 px-2 font-medium">الوقت</th>
            <th className="py-3 px-2 font-medium">المدة</th>
            <th className="py-3 px-2 font-medium">التكلفة</th>
            <th className="py-3 px-2 font-medium">نسبة</th>
            <th className="py-3 px-2 font-medium">نصيب الأخصائي</th>
            <th className="py-3 pl-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => {
            const share = (Number(s.cost) * Number(s.specialist_percentage)) / 100;
            return (
              <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-3 pr-2 font-medium align-top">
                  {s.case_name}
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground font-normal whitespace-pre-wrap max-w-xs">{s.notes}</p>}
                </td>

                <td className="py-3 px-2 text-muted-foreground">{s.session_type || "—"}{s.test_type && <span className="block text-xs text-primary">{s.test_type}</span>}</td>
                <td className="py-3 px-2 text-muted-foreground" dir="ltr">{s.session_time.slice(0, 5)}</td>
                <td className="py-3 px-2 text-muted-foreground">{s.duration_minutes} د</td>
                <td className="py-3 px-2">{Number(s.cost).toFixed(2)}</td>
                <td className="py-3 px-2">
                  <Select value={String(s.specialist_percentage)} onValueChange={(v) => onPercentage(s.id, +v)}>
                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERCENTAGE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3 px-2 font-semibold text-primary">{share.toFixed(2)}</td>
                <td className="py-3 pl-2 text-left">
                  <Button variant="ghost" size="icon" onClick={() => onRemove(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
        {totals && (
          <tfoot className="border-t-2 font-semibold">
            <tr>
              <td className="py-3 pr-2" colSpan={4}>المجموع</td>
              <td className="py-3 px-2">{totals.totalCost.toFixed(2)}</td>
              <td className="py-3 px-2"></td>
              <td className="py-3 px-2 text-primary">{totals.specialistShare.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "shadow-[var(--shadow-card)] bg-[image:var(--gradient-primary)] text-primary-foreground border-0" : "shadow-[var(--shadow-card)]"}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className={highlight ? "text-sm opacity-90" : "text-sm text-muted-foreground"}>{label}</p>
            <p className="mt-1 text-2xl font-bold">{value.toFixed(2)}</p>
          </div>
          <div className={highlight ? "rounded-xl bg-white/20 p-3" : "rounded-xl bg-secondary p-3 text-primary"}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
