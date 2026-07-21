import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.png.asset.json";
import { ShieldCheck, Stethoscope, ArrowRight, Eye, EyeOff } from "lucide-react";

type Mode = "login" | "signup" | "forgot";
type Portal = "admin" | "specialist";

function getPortalFromHash(): Portal | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace("#", "").toLowerCase();
  if (h === "admin" || h === "management" || h === "إدارة") return "admin";
  if (h === "staff" || h === "specialist" || h === "أخصائي") return "specialist";
  return null;
}

export function AuthForm() {
  const [portal, setPortal] = useState<Portal | null>(getPortalFromHash());
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const onHash = () => setPortal(getPortalFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choosePortal = (p: Portal) => {
    window.location.hash = p === "admin" ? "admin" : "staff";
    setPortal(p);
    setMode("login");
  };

  const backToPortals = () => {
    window.location.hash = "";
    setPortal(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!whatsapp.trim()) throw new Error("أدخل رقم WhatsApp");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, whatsapp_number: whatsapp.trim() },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("تم إرسال رابط استعادة كلمة المرور إلى بريدك");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader className="text-center">
            <img src={logo} alt="مركز رعاية للتخاطب والتأهيل" className="mx-auto h-24 w-auto" />
            <CardTitle className="text-2xl mt-2 text-primary">مركز رعاية</CardTitle>
            <CardDescription className="text-accent-foreground">للتخاطب والتأهيل</CardDescription>
            <div className="mt-3 pt-3 border-t">
              <p className="text-base font-semibold">اختر نوع الدخول</p>
              <p className="text-sm text-muted-foreground mt-1">كل دور له بوابة دخول خاصة</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => choosePortal("admin")}
              className="group flex flex-col items-center gap-2 rounded-lg border border-primary/20 bg-card p-5 text-center transition hover:border-primary hover:shadow-md"
            >
              <ShieldCheck className="h-10 w-10 text-primary" />
              <span className="font-semibold">دخول الإدارة</span>
              <span className="text-xs text-muted-foreground">المدير والمشرفون</span>
              <ArrowRight className="h-4 w-4 mt-1 opacity-0 group-hover:opacity-100 transition" />
            </button>
            <button
              type="button"
              onClick={() => choosePortal("specialist")}
              className="group flex flex-col items-center gap-2 rounded-lg border border-primary/20 bg-card p-5 text-center transition hover:border-primary hover:shadow-md"
            >
              <Stethoscope className="h-10 w-10 text-primary" />
              <span className="font-semibold">دخول الأخصائيين</span>
              <span className="text-xs text-muted-foreground">عرض جدول اليوم وتسجيل الحضور</span>
              <ArrowRight className="h-4 w-4 mt-1 opacity-0 group-hover:opacity-100 transition" />
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = portal === "admin";
  const titles: Record<Mode, { t: string; d: string; btn: string }> = {
    login: {
      t: isAdmin ? "دخول الإدارة" : "دخول الأخصائيين",
      d: isAdmin ? "للمدير والمشرفين" : "سجّل دخولك لعرض جدولك اليومي",
      btn: "تسجيل الدخول",
    },
    signup: { t: "إنشاء حساب أخصائي", d: "أنشئ حساباً جديداً للأخصائي", btn: "إنشاء الحساب" },
    forgot: { t: "استعادة كلمة المرور", d: "أدخل بريدك لإرسال رابط الاستعادة", btn: "إرسال الرابط" },
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)] border-primary/10">
        <CardHeader className="text-center">
          <img src={logo} alt="مركز رعاية للتخاطب والتأهيل" className="mx-auto h-24 w-auto" />
          <CardTitle className="text-2xl mt-2 text-primary">مركز رعاية</CardTitle>
          <CardDescription className="text-accent-foreground">للتخاطب والتأهيل</CardDescription>
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-center gap-2">
              {isAdmin ? <ShieldCheck className="h-5 w-5 text-primary" /> : <Stethoscope className="h-5 w-5 text-primary" />}
              <p className="text-base font-semibold">{titles[mode].t}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{titles[mode].d}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أ. محمد علي" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">رقم WhatsApp</Label>
                  <Input id="whatsapp" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+201234567890" dir="ltr" />
                  <p className="text-[11px] text-muted-foreground">يُستخدم لإرسال إشعارات الجدول اليومي والاعتذارات.</p>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">كلمة المرور</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    className="pl-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground transition hover:text-primary"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "جارٍ المعالجة..." : titles[mode].btn}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-2">
            {!isAdmin && mode === "login" && (
              <button type="button" onClick={() => setMode("signup")} className="block w-full text-muted-foreground hover:text-primary">
                ليس لديك حساب؟ <span className="font-semibold">سجّل أخصائي جديد</span>
              </button>
            )}
            {mode === "signup" && (
              <button type="button" onClick={() => setMode("login")} className="block w-full text-muted-foreground hover:text-primary">
                لديك حساب؟ <span className="font-semibold">سجّل الدخول</span>
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("login")} className="block w-full text-muted-foreground hover:text-primary">
                العودة لتسجيل الدخول
              </button>
            )}
            <button type="button" onClick={backToPortals} className="block w-full text-xs text-muted-foreground hover:text-primary pt-2 border-t">
              ← اختيار بوابة دخول أخرى
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
