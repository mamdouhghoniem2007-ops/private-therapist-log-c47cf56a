import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Clock, DollarSign, TrendingUp, CalendarDays, User as UserIcon } from "lucide-react";

type Session = {
  id: string;
  case_name: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  cost: number;
  specialist_percentage: number;
};

const today = () => new Date().toISOString().slice(0, 10);

export function Dashboard({ user }: { user: User }) {
  const [profileName, setProfileName] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filterDate, setFilterDate] = useState(today());
  const [loading, setLoading] = useState(true);

  // form
  const [caseName, setCaseName] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(45);
  const [cost, setCost] = useState<number | "">("");
  const [percentage, setPercentage] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name || user.email || ""));
  }, [user.id, user.email]);

  const loadSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions").select("*")
      .order("session_date", { ascending: false })
      .order("session_time", { ascending: false });
    if (error) toast.error(error.message);
    else setSessions(data as Session[]);
    setLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const addSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cost === "" || cost < 0) return toast.error("أدخل تكلفة صحيحة");
    setSubmitting(true);
    const { error } = await supabase.from("sessions").insert({
      specialist_id: user.id,
      case_name: caseName.trim(),
      session_date: date,
      session_time: time,
      duration_minutes: duration,
      cost: Number(cost),
      specialist_percentage: percentage,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الجلسة");
    setCaseName(""); setCost("");
    loadSessions();
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

  const dayRows = useMemo(() => sessions.filter((s) => s.session_date === filterDate), [sessions, filterDate]);

  const totals = useMemo(() => {
    const totalCost = dayRows.reduce((sum, s) => sum + Number(s.cost), 0);
    const specialistShare = dayRows.reduce((sum, s) => sum + (Number(s.cost) * Number(s.specialist_percentage)) / 100, 0);
    const centerShare = totalCost - specialistShare;
    return { totalCost, specialistShare, centerShare, count: dayRows.length };
  }, [dayRows]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مرحباً</p>
              <p className="font-semibold leading-tight">{profileName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4 ml-2" />
            خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Add form */}
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
                <Label>التاريخ</Label>
                <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>الوقت</Label>
                <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المدة (دقيقة)</Label>
                <Input type="number" min={1} required value={duration} onChange={(e) => setDuration(+e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>التكلفة</Label>
                <Input type="number" min={0} step="0.01" required value={cost} onChange={(e) => setCost(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label>نسبة الأخصائي %</Label>
                <Input type="number" min={0} max={100} step="1" required value={percentage} onChange={(e) => setPercentage(+e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex items-end">
                <Button type="submit" disabled={submitting} className="w-full lg:w-auto">
                  {submitting ? "جارٍ الحفظ..." : "إضافة الجلسة"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Date filter + totals */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <Label className="text-sm">عرض جلسات يوم:</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-auto" />
          </div>
          <p className="text-sm text-muted-foreground">{totals.count} جلسة</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<DollarSign className="h-5 w-5" />} label="إجمالي اليوم" value={totals.totalCost} />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label="نصيب الأخصائي" value={totals.specialistShare} highlight />
          <StatCard icon={<Clock className="h-5 w-5" />} label="نصيب المركز" value={totals.centerShare} />
        </div>

        {/* Sessions list */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-lg">جلسات اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p>
            ) : dayRows.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">لا توجد جلسات في هذا اليوم</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-right text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-2 font-medium">الحالة</th>
                      <th className="py-3 px-2 font-medium">الوقت</th>
                      <th className="py-3 px-2 font-medium">المدة</th>
                      <th className="py-3 px-2 font-medium">التكلفة</th>
                      <th className="py-3 px-2 font-medium">نسبة %</th>
                      <th className="py-3 px-2 font-medium">نصيب الأخصائي</th>
                      <th className="py-3 pl-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dayRows.map((s) => {
                      const share = (Number(s.cost) * Number(s.specialist_percentage)) / 100;
                      return (
                        <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 pr-2 font-medium">{s.case_name}</td>
                          <td className="py-3 px-2 text-muted-foreground" dir="ltr">{s.session_time.slice(0, 5)}</td>
                          <td className="py-3 px-2 text-muted-foreground">{s.duration_minutes} د</td>
                          <td className="py-3 px-2">{Number(s.cost).toFixed(2)}</td>
                          <td className="py-3 px-2">
                            <Input
                              type="number" min={0} max={100} step="1"
                              value={s.specialist_percentage}
                              onChange={(e) => updatePercentage(s.id, +e.target.value)}
                              className="h-8 w-20"
                            />
                          </td>
                          <td className="py-3 px-2 font-semibold text-primary">{share.toFixed(2)}</td>
                          <td className="py-3 pl-2 text-left">
                            <Button variant="ghost" size="icon" onClick={() => removeSession(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 font-semibold">
                    <tr>
                      <td className="py-3 pr-2" colSpan={3}>المجموع</td>
                      <td className="py-3 px-2">{totals.totalCost.toFixed(2)}</td>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-primary">{totals.specialistShare.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
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
