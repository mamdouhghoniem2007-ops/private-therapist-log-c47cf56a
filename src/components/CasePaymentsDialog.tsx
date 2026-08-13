import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Receipt } from "lucide-react";
import { fmtTime12 } from "@/lib/utils";

export type PaymentCase = {
  id: string;
  name: string;
  whatsapp: string | null;
  specialist_id: string;
  payment_type: string;
  discount_percentage: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  method: string;
  period_from: string | null;
  period_to: string | null;
  notes: string | null;
  receipt_no: number;
};

type ApptRow = {
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  session_kind: string;
  session_type: string | null;
  test_type: string | null;
  status: string;
  cost: number | null;
  discount_percentage: number;
};

const METHOD_OPTIONS = [
  { value: "cash", label: "نقدي" },
  { value: "instapay", label: "إنستاباي" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "transfer", label: "تحويل بنكي" },
  { value: "card", label: "بطاقة" },
];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHOD_OPTIONS.map((m) => [m.value, m.label]));

const KIND_LABEL: Record<string, string> = {
  regular: "جلسة عادية",
  assessment: "تقييم",
  test: "اختبار",
};

const CENTER = "مركز رعاية للتخاطب والتأهيل";
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStart = () => todayStr().slice(0, 8) + "01";
const money = (n: number) => n.toFixed(2);

const printHtml = (html: string) => {
  const w = window.open("", "_blank");
  if (!w) { toast.error("فشل فتح النافذة — تأكد من السماح بالنوافذ المنبثقة"); return; }
  w.document.write(html);
  w.document.close();
};

const baseStyles = `
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:22px;color:#111}
  h1{margin:0 0 4px;font-size:20px}
  .meta{color:#555;font-size:12px;margin-bottom:10px;line-height:1.7}
  .summary{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px}
  .chip{padding:8px 12px;border:1px solid #ccc;border-radius:8px;font-size:13px;background:#fafafa}
  .chip b{font-size:15px;margin-inline-start:6px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  th,td{border:1px solid #999;padding:6px 7px;text-align:center}
  thead{background:#f0f0f0}
  tfoot td{font-weight:bold;background:#f5f5f5}
  .toolbar{margin:0 0 14px;display:flex;gap:10px;flex-wrap:wrap}
  .toolbar button{padding:8px 14px;font-size:13px;border:1px solid #888;border-radius:6px;background:#fafafa;cursor:pointer}
  .sign{margin-top:36px;display:flex;justify-content:space-between;font-size:13px}
  @media print { .noprint{display:none} body{padding:10px} }
`;

export function CasePaymentsDialog({
  open, onOpenChange, caseRow, specialistName, currentUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseRow: PaymentCase | null;
  specialistName: string;
  currentUserId: string;
}) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());

  const [amount, setAmount] = useState<string>("");
  const [paidAt, setPaidAt] = useState(todayStr());
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!caseRow) return;
    setLoading(true);
    const [p, a] = await Promise.all([
      supabase.from("payments").select("id, amount, paid_at, method, period_from, period_to, notes, receipt_no")
        .eq("case_id", caseRow.id).order("paid_at", { ascending: false }),
      supabase.from("appointments")
        .select("scheduled_date, scheduled_time, duration_minutes, session_kind, session_type, test_type, status, cost, discount_percentage")
        .eq("case_id", caseRow.id).eq("status", "attended")
        .order("scheduled_date", { ascending: true }),
    ]);
    if (p.error) toast.error(p.error.message);
    if (a.error) toast.error(a.error.message);
    setPayments((p.data as PaymentRow[]) || []);
    setAppts((a.data as ApptRow[]) || []);
    setLoading(false);
  }, [caseRow]);

  useEffect(() => {
    if (!open || !caseRow) return;
    setFrom(monthStart());
    setTo(todayStr());
    setAmount(""); setPaidAt(todayStr()); setMethod("cash"); setNotes("");
    load();
  }, [open, caseRow, load]);

  const netOf = (r: ApptRow) => +(((Number(r.cost) || 0) * (1 - (Number(r.discount_percentage) || 0) / 100)).toFixed(2));

  const totals = useMemo(() => {
    const dueAll = appts.reduce((s, r) => s + netOf(r), 0);
    const paidAll = payments.reduce((s, p) => s + Number(p.amount), 0);
    const inRange = appts.filter((r) => r.scheduled_date >= from && r.scheduled_date <= to);
    const dueRange = inRange.reduce((s, r) => s + netOf(r), 0);
    const paidRange = payments
      .filter((p) => p.paid_at >= from && p.paid_at <= to)
      .reduce((s, p) => s + Number(p.amount), 0);
    return { dueAll, paidAll, balance: +(dueAll - paidAll).toFixed(2), inRange, dueRange, paidRange };
  }, [appts, payments, from, to]);

  const addPayment = async () => {
    if (!caseRow) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغًا صحيحًا");
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      case_id: caseRow.id,
      case_name: caseRow.name,
      amount: amt,
      paid_at: paidAt,
      method,
      period_from: from,
      period_to: to,
      notes: notes.trim() || null,
      created_by: currentUserId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الدفعة");
    setAmount(""); setNotes("");
    load();
  };

  const removePayment = async (id: string) => {
    if (!confirm("حذف هذه الدفعة نهائيًا؟")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  };

  const printReceipt = (p: PaymentRow) => {
    if (!caseRow) return;
    printHtml(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>إيصال دفع رقم ${p.receipt_no}</title><style>${baseStyles}
      .box{max-width:620px;border:1px solid #999;border-radius:10px;padding:20px}
      .amount{font-size:26px;font-weight:bold;margin:14px 0;text-align:center;border:2px dashed #777;border-radius:10px;padding:12px}
      </style></head><body>
      <div class="toolbar noprint"><button onclick="window.print()">طباعة</button></div>
      <div class="box">
        <h1>${CENTER}</h1>
        <div class="meta">إيصال استلام نقدية — رقم <b>${p.receipt_no}</b> · تاريخ الإيصال: ${p.paid_at}</div>
        <div class="meta">
          اسم الحالة: <b>${caseRow.name}</b><br>
          الأخصائي: ${specialistName || "—"}<br>
          طريقة الدفع: ${METHOD_LABEL[p.method] || p.method}<br>
          ${p.period_from && p.period_to ? `عن الفترة: من ${p.period_from} إلى ${p.period_to}<br>` : ""}
          ${p.notes ? `ملاحظات: ${p.notes}` : ""}
        </div>
        <div class="amount">المبلغ المستلم: ${money(Number(p.amount))} جنيه</div>
        <div class="meta">إجمالي المدفوع حتى الآن: ${money(totals.paidAll)} · إجمالي المستحق: ${money(totals.dueAll)} · المتبقي: ${money(totals.balance)}</div>
        <div class="sign"><span>توقيع المستلم: ..................</span><span>ختم المركز</span></div>
      </div></body></html>`);
  };

  const printInvoice = () => {
    if (!caseRow) return;
    const rows = totals.inRange;
    const label = (r: ApptRow) => r.test_type || r.session_type || KIND_LABEL[r.session_kind] || "جلسة";
    const body = rows.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${r.scheduled_date}</td><td>${fmtTime12(r.scheduled_time)}</td>
        <td>${label(r)}</td><td>${money(Number(r.cost) || 0)}</td>
        <td>${Number(r.discount_percentage) ? Number(r.discount_percentage) + "%" : "—"}</td>
        <td>${money(netOf(r))}</td></tr>`).join("");
    const payRows = payments.filter((p) => p.paid_at >= from && p.paid_at <= to)
      .map((p) => `<tr><td>${p.receipt_no}</td><td>${p.paid_at}</td><td>${METHOD_LABEL[p.method] || p.method}</td><td>${money(Number(p.amount))}</td></tr>`).join("");
    printHtml(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>فاتورة ${caseRow.name}</title><style>${baseStyles}</style></head><body>
      <div class="toolbar noprint"><button onclick="window.print()">طباعة</button></div>
      <h1>${CENTER} — فاتورة</h1>
      <div class="meta">
        اسم الحالة: <b>${caseRow.name}</b> · الأخصائي: ${specialistName || "—"}<br>
        الفترة: من ${from} إلى ${to} · تاريخ الإصدار: ${new Date().toLocaleString("ar-EG")}
      </div>
      <div class="summary">
        <div class="chip">عدد الجلسات <b>${rows.length}</b></div>
        <div class="chip">مستحق الفترة <b>${money(totals.dueRange)}</b></div>
        <div class="chip">مدفوع بالفترة <b>${money(totals.paidRange)}</b></div>
        <div class="chip">إجمالي المتبقي <b>${money(totals.balance)}</b></div>
      </div>
      <table><thead><tr><th>#</th><th>التاريخ</th><th>الوقت</th><th>نوع الجلسة</th><th>السعر</th><th>الخصم</th><th>الصافي</th></tr></thead>
      <tbody>${body || `<tr><td colspan="7">لا توجد جلسات حضور في هذه الفترة</td></tr>`}</tbody>
      <tfoot><tr><td colspan="6">إجمالي مستحق الفترة</td><td>${money(totals.dueRange)}</td></tr></tfoot></table>
      <h1 style="margin-top:22px;font-size:16px">الدفعات خلال الفترة</h1>
      <table><thead><tr><th>رقم الإيصال</th><th>التاريخ</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead>
      <tbody>${payRows || `<tr><td colspan="4">لا توجد دفعات</td></tr>`}</tbody>
      <tfoot><tr><td colspan="3">إجمالي المدفوع بالفترة</td><td>${money(totals.paidRange)}</td></tr></tfoot></table>
      <div class="sign"><span>الرصيد المتبقي على الحالة: <b>${money(totals.balance)}</b> جنيه</span><span>ختم المركز</span></div>
      </body></html>`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>المدفوعات والفواتير — {caseRow?.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <div className="text-xs text-muted-foreground">إجمالي المستحق</div>
              <div className="font-bold">{money(totals.dueAll)}</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-muted-foreground">إجمالي المدفوع</div>
              <div className="font-bold text-emerald-700">{money(totals.paidAll)}</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-muted-foreground">المتبقي</div>
              <div className={`font-bold ${totals.balance > 0 ? "text-destructive" : "text-emerald-700"}`}>{money(totals.balance)}</div>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-medium">فترة الفاتورة</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="text-xs text-muted-foreground">
              جلسات الفترة: {totals.inRange.length} · مستحق: {money(totals.dueRange)} · مدفوع: {money(totals.paidRange)}
            </div>
            <Button size="sm" variant="outline" onClick={printInvoice}>
              <Printer className="h-4 w-4 ml-1" /> طباعة فاتورة الفترة
            </Button>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-medium">تسجيل دفعة جديدة</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>المبلغ</Label>
                <Input type="number" min={0} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الدفع</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={addPayment} disabled={saving}>
              <Plus className="h-4 w-4 ml-1" /> {saving ? "جارٍ الحفظ..." : "تسجيل الدفعة"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">سجل الدفعات</div>
            {loading && <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>}
            {!loading && payments.length === 0 && <p className="text-xs text-muted-foreground">لا توجد دفعات مسجّلة</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <div>
                  <div className="font-medium">{money(Number(p.amount))} · {METHOD_LABEL[p.method] || p.method}</div>
                  <div className="text-xs text-muted-foreground">
                    إيصال #{p.receipt_no} · {p.paid_at}{p.notes ? ` · ${p.notes}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => printReceipt(p)}>
                    <Receipt className="h-4 w-4 ml-1" /> إيصال
                  </Button>
                  <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => removePayment(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
