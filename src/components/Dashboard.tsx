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
import { LogOut, Plus, Trash2, Clock, DollarSign, TrendingUp, CalendarDays, Shield, Users, CalendarPlus, CalendarClock, UserCog } from "lucide-react";
import logo from "@/assets/logo.png";

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
};

type Profile = { id: string; full_name: string };
type RoleRow = { user_id: string; role: Role };

const today = () => new Date().toISOString().slice(0, 10);

const DURATION_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
const PERCENTAGE_OPTIONS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const TESTS_LABEL = "اختبارات";
const SESSION_TYPES = ["تخاطب", "تأهيل", "تعديل سلوك", "تنمية مهارات", "صعوبات تعلم", "علاج وظيفي", "تقييم", TESTS_LABEL];
const TEST_TYPES = [
  "IQ ستانفورد بينيه",
  "وكسلر للأطفال",
  "مقياس جيليام للتوحد (GARS)",
  "بورتاج للنمو",
  "فاينلاند للسلوك التكيفي",
  "بيبودي للمفردات (PPVT)",
  "مقياس اللغة المستقبلة والتعبيرية (REEL)",
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
      created_by: user.id,
    });
    setASubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة الموعد للجدول");
    setACase(""); setANotes(""); setACost("");
    loadAll();
  };

  const removeAppointment = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((a) => a.filter((x) => x.id !== id));
    toast.success("تم حذف الموعد");
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
                      <AppointmentRow key={a.id} a={a} actionLabel="تسجيل" onAction={() => useAppointment(a)} />
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
                <div className="space-y-2 lg:col-span-3">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input value={aNotes} onChange={(e) => setANotes(e.target.value)} placeholder="..." />
                </div>
                <div className="lg:col-span-3 flex items-end">
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
                    />
                  ))}

                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin: role management */}
        {isAdmin && (
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />
                إدارة صلاحيات المستخدمين
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allUsersForRoles.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">لا يوجد مستخدمون آخرون بعد</p>
              ) : (
                <div className="divide-y">
                  {allUsersForRoles.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">الدور الحالي: {ROLE_LABEL[u.role]}</p>
                      </div>
                      <Select value={u.role} onValueChange={(v) => changeUserRole(u.id, v as Role)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="specialist">أخصائي</SelectItem>
                          <SelectItem value="supervisor">مشرف</SelectItem>
                          <SelectItem value="admin">مدير</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
  a, subtitle, actionLabel, onAction, onRemove, onCostChange, onPercentageChange,
}: {
  a: Appointment;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRemove?: () => void;
  onCostChange?: (v: number) => void;
  onPercentageChange?: (v: number) => void;
}) {
  const [costDraft, setCostDraft] = useState<string>(a.cost != null ? String(a.cost) : "");
  useEffect(() => { setCostDraft(a.cost != null ? String(a.cost) : ""); }, [a.cost]);
  const share = a.cost != null ? (Number(a.cost) * Number(a.specialist_percentage)) / 100 : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{a.case_name}</span>
          {a.session_type && <span className="text-xs rounded bg-accent/20 px-2 py-0.5 text-accent-foreground">{a.session_type}</span>}
          {a.test_type && <span className="text-xs rounded bg-primary/15 px-2 py-0.5 text-primary">{a.test_type}</span>}
          {subtitle && <span className="text-xs text-muted-foreground">— {subtitle}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1" dir="ltr">
          {a.scheduled_time.slice(0, 5)} · {a.duration_minutes} د
          {a.cost != null && !onCostChange && <span dir="rtl"> · تكلفة: {Number(a.cost).toFixed(2)}</span>}
          {!onPercentageChange && <span dir="rtl"> · نسبة: {a.specialist_percentage}%</span>}
          {share != null && <span dir="rtl"> · نصيب الأخصائي: {share.toFixed(2)}</span>}
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
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction}>{actionLabel}</Button>
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
