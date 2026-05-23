import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

type Mode = "login" | "signup" | "forgot";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

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

  const titles: Record<Mode, { t: string; d: string; btn: string }> = {
    login: { t: "تسجيل الدخول", d: "سجّل دخولك للمتابعة إلى لوحتك", btn: "تسجيل الدخول" },
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
            <p className="text-base font-semibold">{titles[mode].t}</p>
            <p className="text-sm text-muted-foreground mt-1">{titles[mode].d}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أ. محمد علي" />
              </div>
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
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "جارٍ المعالجة..." : titles[mode].btn}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {mode === "login" && (
              <button type="button" onClick={() => setMode("signup")} className="text-muted-foreground hover:text-primary">
                ليس لديك حساب؟ <span className="font-semibold">سجّل أخصائي جديد</span>
              </button>
            )}
            {mode === "signup" && (
              <button type="button" onClick={() => setMode("login")} className="text-muted-foreground hover:text-primary">
                لديك حساب؟ <span className="font-semibold">سجّل الدخول</span>
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("login")} className="text-muted-foreground hover:text-primary">
                العودة لتسجيل الدخول
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
