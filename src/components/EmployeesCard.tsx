import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCog, UserPlus, Pencil, Trash2 } from "lucide-react";
import { createEmployee, deleteEmployee } from "@/lib/employees.functions";

type Role = "admin" | "specialist" | "supervisor";
const ROLE_LABEL: Record<Role, string> = { admin: "مدير", supervisor: "مشرف", specialist: "أخصائي" };

type Row = { id: string; full_name: string; whatsapp_number: string | null; role: Role };

export function EmployeesCard({ currentUserId, onChanged }: { currentUserId: string; onChanged?: () => void }) {
  const create = useServerFn(createEmployee);
  const remove = useServerFn(deleteEmployee);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // add form
  const [addOpen, setAddOpen] = useState(false);
  const [nEmail, setNEmail] = useState("");
  const [nPassword, setNPassword] = useState("");
  const [nName, setNName] = useState("");
  const [nWhatsapp, setNWhatsapp] = useState("");
  const [nRole, setNRole] = useState<Role>("specialist");
  const [submitting, setSubmitting] = useState(false);

  // edit
  const [editing, setEditing] = useState<Row | null>(null);
  const [eName, setEName] = useState("");
  const [eWhatsapp, setEWhatsapp] = useState("");
  const [eRole, setERole] = useState<Role>("specialist");
  const [eSaving, setESaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profs, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, whatsapp_number"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) toast.error(pErr.message);
    if (rErr) toast.error(rErr.message);
    const roleMap: Record<string, Role> = {};
    (roles || []).forEach((r: any) => {
      if (!roleMap[r.user_id] || r.role === "admin") roleMap[r.user_id] = r.role;
    });
    const list: Row[] = ((profs as any[]) || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      whatsapp_number: p.whatsapp_number ?? null,
      role: (roleMap[p.id] || "specialist") as Role,
    }));
    list.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nEmail || !nPassword || !nName) return toast.error("أدخل البيانات الأساسية");
    setSubmitting(true);
    try {
      await create({
        data: {
          email: nEmail.trim(),
          password: nPassword,
          full_name: nName.trim(),
          whatsapp_number: nWhatsapp.trim() || null,
          role: nRole,
        },
      });
      toast.success("تم إضافة الموظف");
      setAddOpen(false);
      setNEmail(""); setNPassword(""); setNName(""); setNWhatsapp(""); setNRole("specialist");
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setEName(r.full_name);
    setEWhatsapp(r.whatsapp_number ?? "");
    setERole(r.role);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setESaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: eName.trim(), whatsapp_number: eWhatsapp.trim() || null })
        .eq("id", editing.id);
      if (pErr) throw new Error(pErr.message);

      if (eRole !== editing.role) {
        if (editing.id === currentUserId) throw new Error("لا يمكنك تغيير دورك بنفسك");
        const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", editing.id);
        if (dErr) throw new Error(dErr.message);
        const { error: iErr } = await supabase.from("user_roles").insert({ user_id: editing.id, role: eRole });
        if (iErr) throw new Error(iErr.message);
      }
      toast.success("تم حفظ التعديلات");
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "فشل الحفظ");
    } finally {
      setESaving(false);
    }
  };

  const onDelete = async (r: Row) => {
    if (r.id === currentUserId) return toast.error("لا يمكنك حذف حسابك");
    if (!confirm(`حذف الموظف "${r.full_name}" نهائياً؟`)) return;
    try {
      await remove({ data: { user_id: r.id } });
      toast.success("تم حذف الموظف");
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "فشل الحذف");
    }
  };

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          إدارة الموظفين
          <span className="text-xs text-muted-foreground font-normal">({rows.length})</span>
        </CardTitle>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 ml-1" />
          إضافة موظف
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا يوجد موظفون بعد</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.full_name}
                    {r.id === currentUserId && <span className="text-xs text-muted-foreground mr-2">(أنت)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[r.role]}
                    {r.whatsapp_number && <span dir="ltr"> · {r.whatsapp_number}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5 ml-1" />
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(r)}
                    disabled={r.id === currentUserId}
                  >
                    <Trash2 className="h-3.5 w-3.5 ml-1" />
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle></DialogHeader>
          <form onSubmit={onAdd} className="space-y-3">
            <div className="space-y-1.5">
              <Label>الاسم الكامل</Label>
              <Input value={nName} onChange={(e) => setNName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور</Label>
              <Input type="text" value={nPassword} onChange={(e) => setNPassword(e.target.value)} minLength={6} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم WhatsApp (اختياري)</Label>
              <Input value={nWhatsapp} onChange={(e) => setNWhatsapp(e.target.value)} dir="ltr" placeholder="+201234567890" />
            </div>
            <div className="space-y-1.5">
              <Label>الدور</Label>
              <Select value={nRole} onValueChange={(v) => setNRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="specialist">أخصائي</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "إضافة"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل بيانات الموظف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>الاسم الكامل</Label>
              <Input value={eName} onChange={(e) => setEName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>رقم WhatsApp</Label>
              <Input value={eWhatsapp} onChange={(e) => setEWhatsapp(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>الدور</Label>
              <Select value={eRole} onValueChange={(v) => setERole(v as Role)} disabled={editing?.id === currentUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="specialist">أخصائي</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={eSaving}>{eSaving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
