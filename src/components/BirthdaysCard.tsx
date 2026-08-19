import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cake, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/lib/whatsapp";

type Role = "admin" | "supervisor" | "specialist";

type BirthdayCase = {
  id: string;
  name: string;
  whatsapp: string | null;
  birth_date: string;
  specialist_id: string;
};

const iso = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

// بداية الأسبوع (السبت) وحتى الجمعة
const weekRange = (base = new Date()) => {
  const d = new Date(base);
  const dow = d.getDay(); // 0=أحد ... 6=سبت
  const back = (dow + 1) % 7; // كم يوم للرجوع للسبت
  const start = new Date(d);
  start.setDate(d.getDate() - back);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: iso(start), to: iso(end) };
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

const ageOn = (birth: string, onDate: string) => {
  const b = new Date(birth);
  const o = new Date(onDate);
  let a = o.getFullYear() - b.getFullYear();
  const before = o.getMonth() < b.getMonth() || (o.getMonth() === b.getMonth() && o.getDate() < b.getDate());
  if (before) a -= 1;
  return a;
};

const greeting = (name: string, age: number) =>
  [
    `🎂 *كل سنة وأنتم طيبين*`,
    ``,
    `نبارك لحضراتكم عيد ميلاد *${name}* 🎉`,
    age > 0 ? `تمام *${age}* سنة من العمر بإذن الله 🌟` : "",
    ``,
    `كل عام و${name} بخير وصحة وسعادة، وندعو الله أن يسعدكم به دائمًا.`,
    ``,
    `— مركز رعاية`,
  ]
    .filter(Boolean)
    .join("\n");

export function BirthdaysCard({
  role,
  userId,
  profilesMap,
}: {
  role: Role;
  userId: string;
  profilesMap: Record<string, string>;
}) {
  const initial = weekRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<BirthdayCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cases")
      .select("id, name, whatsapp, birth_date, specialist_id")
      .not("birth_date", "is", null)
      .eq("archived", false);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as BirthdayCase[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  // الحالات اللي عيد ميلادها (شهر/يوم) داخل المدى المحدد
  const matches = useMemo(() => {
    const start = new Date(from);
    const end = new Date(to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days: { key: string; date: string }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push({ key: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, date: iso(d) });
    }
    const visible = role === "specialist" ? rows.filter((r) => r.specialist_id === userId) : rows;
    const out: (BirthdayCase & { onDate: string; age: number })[] = [];
    for (const day of days) {
      for (const r of visible) {
        if (r.birth_date.slice(5) === day.key) {
          out.push({ ...r, onDate: day.date, age: ageOn(r.birth_date, day.date) });
        }
      }
    }
    return out.sort((a, b) => a.onDate.localeCompare(b.onDate));
  }, [rows, from, to, role, userId]);

  const thisWeek = () => {
    const w = weekRange();
    setFrom(w.from);
    setTo(w.to);
  };
  const nextWeek = () => {
    const base = new Date();
    base.setDate(base.getDate() + 7);
    const w = weekRange(base);
    setFrom(w.from);
    setTo(w.to);
  };

  const print = () => {
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>أعياد الميلاد</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:14px}
      th{background:#f4f4f5}</style></head><body>
      <h1>🎂 أعياد ميلاد الأطفال — من ${from} إلى ${to}</h1>
      <table><thead><tr><th>الطفل</th><th>التاريخ</th><th>السن</th><th>الأخصائي</th><th>واتساب</th></tr></thead><tbody>
      ${matches
        .map(
          (m) =>
            `<tr><td>${m.name}</td><td>${fmtDate(m.onDate)}</td><td>${m.age}</td><td>${
              profilesMap[m.specialist_id] || "—"
            }</td><td>${m.whatsapp || "—"}</td></tr>`,
        )
        .join("")}
      </tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("فشل فتح النافذة — تأكد من السماح بالنوافذ المنبثقة");
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            أعياد ميلاد الأطفال
            {matches.length > 0 && <Badge variant="secondary">{matches.length}</Badge>}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={thisWeek}>هذا الأسبوع</Button>
            <Button size="sm" variant="outline" onClick={nextWeek}>الأسبوع القادم</Button>
            <Button size="sm" variant="outline" onClick={print} disabled={matches.length === 0}>
              <Printer className="h-4 w-4 ml-1" /> طباعة
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>من</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>إلى</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد أعياد ميلاد في هذه الفترة.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const link = waLink(m.whatsapp, greeting(m.name, m.age));
              return (
                <div key={`${m.id}-${m.onDate}`} className="flex items-center justify-between gap-2 flex-wrap rounded-lg border p-3">
                  <div>
                    <div className="font-medium">🎉 {m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(m.onDate)} · {m.age} سنة · {profilesMap[m.specialist_id] || "—"}
                    </div>
                  </div>
                  {link ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={link} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 ml-1" /> تهنئة واتساب
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">لا يوجد رقم واتساب</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
