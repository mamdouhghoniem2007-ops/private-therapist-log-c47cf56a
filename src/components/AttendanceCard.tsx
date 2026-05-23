import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, LogOut as LogOutIcon, Users } from "lucide-react";

type Role = "admin" | "supervisor" | "specialist";
type AttendanceRow = {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—";
const diffHours = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
};

const ROLE_LABEL: Record<Role, string> = { admin: "مدير", supervisor: "مشرف", specialist: "أخصائي" };

export function AttendanceCard({
  user,
  role,
  profilesMap,
  allRoles,
}: {
  user: User;
  role: Role;
  profilesMap: Record<string, string>;
  allRoles: Record<string, Role>;
}) {
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const canViewAll = isAdmin || isSupervisor;

  const [date, setDate] = useState(today());
  const [my, setMy] = useState<AttendanceRow | null>(null);
  const [all, setAll] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (canViewAll) {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("work_date", date)
        .order("check_in", { ascending: true });
      if (error) toast.error(error.message);
      const rows = (data as AttendanceRow[]) || [];
      setAll(rows);
      setMy(rows.find((r) => r.user_id === user.id) || null);
    } else {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("work_date", date)
        .maybeSingle();
      if (error && error.code !== "PGRST116") toast.error(error.message);
      setMy((data as AttendanceRow) || null);
    }
    setLoading(false);
  }, [date, user.id, canViewAll]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    if (my) {
      const { error } = await supabase.from("attendance").update({ check_in: now }).eq("id", my.id);
      if (error) toast.error(error.message);
      else toast.success("تم تسجيل الحضور");
    } else {
      const { error } = await supabase
        .from("attendance")
        .insert({ user_id: user.id, work_date: date, check_in: now });
      if (error) toast.error(error.message);
      else toast.success("تم تسجيل الحضور");
    }
    setBusy(false);
    load();
  };

  const checkOut = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    if (my) {
      const { error } = await supabase.from("attendance").update({ check_out: now }).eq("id", my.id);
      if (error) toast.error(error.message);
      else toast.success("تم تسجيل الانصراف");
    } else {
      const { error } = await supabase
        .from("attendance")
        .insert({ user_id: user.id, work_date: date, check_out: now });
      if (error) toast.error(error.message);
      else toast.success("تم تسجيل الانصراف");
    }
    setBusy(false);
    load();
  };

  const isToday = date === today();

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            الحضور والانصراف
          </span>
          <div className="flex items-center gap-2">
            <Label className="text-xs">اليوم:</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-auto" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Personal check-in/out */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            <div>
              <p className="font-medium">سجلي اليوم</p>
              <p className="text-xs text-muted-foreground">
                حضور: <b className="text-foreground">{fmtTime(my?.check_in ?? null)}</b>
                {"  "}·{"  "}
                انصراف: <b className="text-foreground">{fmtTime(my?.check_out ?? null)}</b>
                {diffHours(my?.check_in ?? null, my?.check_out ?? null) && (
                  <>
                    {"  "}·{"  "}مدة العمل: <b className="text-foreground">{diffHours(my?.check_in ?? null, my?.check_out ?? null)}</b>
                  </>
                )}
              </p>
            </div>
            {isToday && (
              <div className="flex gap-2">
                <Button size="sm" onClick={checkIn} disabled={busy || !!my?.check_in}>
                  <LogIn className="h-4 w-4 ml-1" />
                  حضور
                </Button>
                <Button size="sm" variant="secondary" onClick={checkOut} disabled={busy || !my?.check_in || !!my?.check_out}>
                  <LogOutIcon className="h-4 w-4 ml-1" />
                  انصراف
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Admin/Supervisor: all staff for the day */}
        {canViewAll && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">سجلات اليوم ({all.length})</p>
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>
            ) : all.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">لا توجد سجلات حضور في هذا اليوم</p>
            ) : (
              <div className="divide-y rounded-md border">
                {all.map((r) => {
                  const name = profilesMap[r.user_id] || "—";
                  const userRole = allRoles[r.user_id];
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div>
                        <p className="font-medium">{name}</p>
                        {userRole && <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[userRole]}</p>}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                        <span>حضور: <b className="text-foreground">{fmtTime(r.check_in)}</b></span>
                        <span>انصراف: <b className="text-foreground">{fmtTime(r.check_out)}</b></span>
                        {diffHours(r.check_in, r.check_out) && (
                          <span>المدة: <b className="text-foreground">{diffHours(r.check_in, r.check_out)}</b></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
