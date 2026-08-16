import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ClipboardPlus, Plus, Trash2, Pencil, Save, X, Printer, FileText, FileDown, UserPlus, ChevronDown, ChevronUp,
} from "lucide-react";

type Role = "admin" | "supervisor" | "specialist";

type StudyRow = {
  id: string;
  case_id: string | null;
  child_name: string;
  specialist_id: string | null;
  status: string;
  data: Record<string, any>;
  created_at: string;
};

type Field = { key: string; label: string; type?: "text" | "date" | "textarea" | "number" };
type Section = { key: string; title: string; fields: Field[] };

const RECOMMENDED_TESTS = [
  "IQ ستانفورد بينيه",
  "وكسلر للأطفال",
  "ADHD - فرط الحركة وتشتت الانتباه",
  "مقياس كونرز (Conners)",
  "مقياس جيليام للتوحد (GARS)",
  "بورتاج للنمو",
  "فاينلاند للسلوك التكيفي",
  "اختبار اللغة",
  "اختبار صعوبات التعلم",
  "تقييم النطق والكلام",
];

const SECTIONS: Section[] = [
  {
    key: "child",
    title: "البيانات الشخصية للطفل",
    fields: [
      { key: "birth_date", label: "تاريخ الميلاد", type: "date" },
      { key: "age", label: "العمر" },
      { key: "gender", label: "النوع" },
      { key: "nationality", label: "الجنسية" },
      { key: "address", label: "العنوان" },
      { key: "phone", label: "رقم التواصل / واتساب" },
      { key: "school", label: "المدرسة / الحضانة" },
      { key: "grade", label: "الصف الدراسي" },
      { key: "siblings", label: "عدد الإخوة وترتيب الطفل" },
    ],
  },
  {
    key: "father",
    title: "بيانات الأب",
    fields: [
      { key: "name", label: "الاسم" },
      { key: "age", label: "السن" },
      { key: "education", label: "المؤهل" },
      { key: "job", label: "الوظيفة" },
      { key: "phone", label: "رقم التواصل" },
      { key: "health", label: "الحالة الصحية / أمراض وراثية", type: "textarea" },
    ],
  },
  {
    key: "mother",
    title: "بيانات الأم",
    fields: [
      { key: "name", label: "الاسم" },
      { key: "age", label: "السن" },
      { key: "education", label: "المؤهل" },
      { key: "job", label: "الوظيفة" },
      { key: "phone", label: "رقم التواصل" },
      { key: "health", label: "الحالة الصحية / أمراض وراثية", type: "textarea" },
      { key: "relation", label: "صلة القرابة بين الأب والأم" },
    ],
  },
  {
    key: "referral",
    title: "سبب الإحالة ومصدرها",
    fields: [
      { key: "reason", label: "سبب الإحالة / الشكوى الحالية", type: "textarea" },
      { key: "source", label: "مصدر الإحالة (طبيب / مدرسة / الأسرة / مركز آخر)" },
      { key: "start_of_problem", label: "متى بدأت المشكلة" },
      { key: "referral_date", label: "تاريخ الإحالة", type: "date" },
    ],
  },
  {
    key: "pregnancy",
    title: "بيانات طبية عن الأم خلال الحمل والولادة",
    fields: [
      { key: "pregnancy_health", label: "حالة الأم أثناء الحمل (أمراض / أدوية / نزيف)", type: "textarea" },
      { key: "pregnancy_followup", label: "متابعة الحمل والتحاليل" },
      { key: "birth_type", label: "نوع الولادة (طبيعية / قيصرية)" },
      { key: "birth_term", label: "ميعاد الولادة (في الميعاد / مبتسرة)" },
      { key: "birth_weight", label: "وزن الطفل عند الولادة" },
      { key: "birth_cry", label: "الصرخة الأولى / نقص الأكسجين" },
      { key: "jaundice", label: "الصفراء أو الحضّانة", type: "textarea" },
      { key: "birth_notes", label: "ملاحظات أخرى عن الولادة", type: "textarea" },
    ],
  },
  {
    key: "child_medical",
    title: "البيانات الطبية للطفل",
    fields: [
      { key: "diagnosis", label: "التشخيص الطبي (إن وجد)", type: "textarea" },
      { key: "chronic", label: "أمراض مزمنة" },
      { key: "convulsions", label: "تشنجات / صرع" },
      { key: "hearing", label: "فحص السمع" },
      { key: "vision", label: "فحص النظر" },
      { key: "medications", label: "الأدوية الحالية", type: "textarea" },
      { key: "surgeries", label: "عمليات جراحية / حوادث", type: "textarea" },
      { key: "sleep_feeding", label: "النوم والتغذية", type: "textarea" },
    ],
  },
  {
    key: "development",
    title: "النمو التطوري للطفل",
    fields: [
      { key: "head_control", label: "التحكم في الرأس" },
      { key: "sitting", label: "الجلوس" },
      { key: "crawling", label: "الحبو" },
      { key: "walking", label: "المشي" },
      { key: "babbling", label: "المناغاة" },
      { key: "first_words", label: "أول كلمة" },
      { key: "sentences", label: "تكوين الجمل" },
      { key: "toilet", label: "التحكم في الإخراج" },
      { key: "self_care", label: "مهارات العناية بالذات" },
      { key: "social", label: "التواصل الاجتماعي واللعب", type: "textarea" },
      { key: "behavior", label: "السلوكيات الملحوظة", type: "textarea" },
    ],
  },
  {
    key: "previous_steps",
    title: "الخطوات السابقة قبل التواصل مع المركز",
    fields: [
      { key: "previous_centers", label: "مراكز سابقة ومدة التدريب", type: "textarea" },
      { key: "previous_programs", label: "برامج / جلسات سابقة", type: "textarea" },
      { key: "doctors", label: "أطباء تمت زيارتهم" },
      { key: "tests_done", label: "اختبارات تم تطبيقها سابقًا", type: "textarea" },
      { key: "results", label: "نتائج التدخل السابق", type: "textarea" },
    ],
  },
];

const emptyData = () => ({ tests: [] as string[], tests_notes: "", notes: "" }) as Record<string, any>;

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("ar-EG");

function buildHtml(s: StudyRow, specialistName: string) {
  const d = s.data || {};
  const rows = (sec: Section) =>
    sec.fields
      .map((f) => {
        const v = d[sec.key]?.[f.key];
        if (!v) return "";
        return `<tr><th>${f.label}</th><td>${String(v).replace(/\n/g, "<br/>")}</td></tr>`;
      })
      .join("");
  const sections = SECTIONS.map((sec) => {
    const body = rows(sec);
    if (!body) return "";
    return `<h2>${sec.title}</h2><table>${body}</table>`;
  }).join("");
  const tests: string[] = Array.isArray(d.tests) ? d.tests : [];
  const testsHtml =
    tests.length || d.tests_notes
      ? `<h2>الاختبارات المرشح تطبيقها</h2><table>${
          tests.length ? `<tr><th>الاختبارات</th><td>${tests.join(" — ")}</td></tr>` : ""
        }${d.tests_notes ? `<tr><th>ملاحظات</th><td>${String(d.tests_notes).replace(/\n/g, "<br/>")}</td></tr>` : ""}</table>`
      : "";
  const notesHtml = d.notes
    ? `<h2>ملاحظات</h2><table><tr><td>${String(d.notes).replace(/\n/g, "<br/>")}</td></tr></table>`
    : "";
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>دراسة حالة - ${s.child_name}</title>
<style>
body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;padding:24px;color:#1b1b1b}
h1{text-align:center;margin:0 0 4px;font-size:22px}
.sub{text-align:center;color:#555;margin-bottom:18px;font-size:13px}
h2{font-size:15px;background:#eef4fb;border-right:4px solid #2c6fbb;padding:6px 10px;margin:18px 0 6px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
th,td{border:1px solid #cfd8e3;padding:6px 8px;font-size:13px;text-align:right;vertical-align:top}
th{background:#f7f9fc;width:32%;font-weight:600}
@media print{body{padding:0}}
</style></head><body>
<h1>دراسة حالة — ${s.child_name}</h1>
<div class="sub">الأخصائي المسؤول: ${specialistName || "—"} • تاريخ الإنشاء: ${fmtDate(s.created_at)}</div>
${sections}${testsHtml}${notesHtml}
</body></html>`;
}

export function CaseStudiesCard({
  user, role, specialists, profilesMap,
}: {
  user: User;
  role: Role;
  specialists: { id: string; full_name: string }[];
  profilesMap: Record<string, string>;
}) {
  const canManage = role === "admin" || role === "supervisor";
  const [rows, setRows] = useState<StudyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudyRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("case_studies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر تحميل دراسات الحالة");
    setRows(((data as any[]) || []).map((r) => ({ ...r, data: (r.data as any) || {} })) as StudyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const specialistName = (id: string | null) => (id ? profilesMap[id] || "" : "");

  const startNew = () => {
    setEditingId("new");
    setDraft({
      id: "new",
      case_id: null,
      child_name: "",
      specialist_id: role === "specialist" ? user.id : null,
      status: "draft",
      data: emptyData(),
      created_at: new Date().toISOString(),
    });
  };

  const startEdit = (r: StudyRow) => {
    setEditingId(r.id);
    setDraft({ ...r, data: { ...emptyData(), ...(r.data || {}) } });
  };

  const cancel = () => { setEditingId(null); setDraft(null); };

  const setField = (sectionKey: string, fieldKey: string, value: string) => {
    setDraft((d) =>
      d ? { ...d, data: { ...d.data, [sectionKey]: { ...(d.data[sectionKey] || {}), [fieldKey]: value } } } : d
    );
  };

  const toggleTest = (t: string) => {
    setDraft((d) => {
      if (!d) return d;
      const cur: string[] = Array.isArray(d.data.tests) ? d.data.tests : [];
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      return { ...d, data: { ...d.data, tests: next } };
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.child_name.trim()) { toast.error("اكتب اسم الطفل"); return; }
    setSaving(true);
    const payload = {
      child_name: draft.child_name.trim(),
      specialist_id: draft.specialist_id,
      data: draft.data,
      status: draft.status,
    };
    let error;
    if (editingId === "new") {
      ({ error } = await supabase.from("case_studies").insert({ ...payload, created_by: user.id } as any));
    } else {
      ({ error } = await supabase.from("case_studies").update(payload as any).eq("id", draft.id));
    }
    setSaving(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success("تم حفظ دراسة الحالة");
    cancel();
    void load();
  };

  const remove = async (r: StudyRow) => {
    if (!confirm(`حذف دراسة الحالة الخاصة بـ ${r.child_name}؟`)) return;
    const { error } = await supabase.from("case_studies").delete().eq("id", r.id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم الحذف");
    void load();
  };

  const convertToCase = async (r: StudyRow) => {
    if (r.case_id) { toast.info("تم تحويلها لملف طفل بالفعل"); return; }
    const specialistId = r.specialist_id || specialists[0]?.id;
    if (!specialistId) { toast.error("حدد الأخصائي المسؤول أولًا"); return; }
    if (!confirm(`تحويل دراسة حالة "${r.child_name}" إلى ملف طفل؟`)) return;
    const { data, error } = await supabase
      .from("cases")
      .insert({
        name: r.child_name,
        whatsapp: r.data?.child?.phone || null,
        specialist_id: specialistId,
        recurring_days: [],
        recurring_time: "16:00",
        start_date: today(),
        active: true,
        notes: `محوّلة من دراسة حالة${r.data?.referral?.reason ? " — " + r.data.referral.reason : ""}`,
        created_by: user.id,
      } as any)
      .select("id")
      .single();
    if (error || !data) { toast.error("تعذر التحويل: " + (error?.message || "")); return; }
    const { error: linkErr } = await supabase
      .from("case_studies")
      .update({ case_id: (data as any).id, status: "converted" } as any)
      .eq("id", r.id);
    if (linkErr) toast.error("تم إنشاء الملف لكن تعذر الربط");
    toast.success("تم إنشاء ملف الطفل — أكمل المواعيد من ملف الحالات");
    void load();
  };

  const doPrint = (r: StudyRow) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("اسمح بالنوافذ المنبثقة للطباعة"); return; }
    w.document.write(buildHtml(r, specialistName(r.specialist_id)));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const doWord = (r: StudyRow) => {
    const blob = new Blob(["\ufeff", buildHtml(r, specialistName(r.specialist_id))], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `دراسة-حالة-${r.child_name}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => rows, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardPlus className="h-5 w-5" />
          دراسات الحالة
        </CardTitle>
        <Button size="sm" onClick={editingId === "new" ? cancel : startNew}>
          {editingId === "new" ? <X className="ml-1 h-4 w-4" /> : <Plus className="ml-1 h-4 w-4" />}
          {editingId === "new" ? "إلغاء" : "دراسة حالة جديدة"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {editingId === "new" && draft && (
          <StudyForm
            draft={draft}
            setDraft={setDraft}
            setField={setField}
            toggleTest={toggleTest}
            specialists={specialists}
            canPickSpecialist={canManage}
            onSave={save}
            onCancel={cancel}
            saving={saving}
          />
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد دراسات حالة بعد.</p>
        ) : (
          visible.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{r.child_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {specialistName(r.specialist_id) || "بدون أخصائي"} • {fmtDate(r.created_at)}
                    {r.case_id ? " • تم تحويلها لملف طفل" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                    {open[r.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    عرض
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doPrint(r)} title="طباعة أو حفظ PDF">
                    <Printer className="ml-1 h-4 w-4" /> طباعة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doPrint(r)} title="احفظ كـ PDF من نافذة الطباعة">
                    <FileDown className="ml-1 h-4 w-4" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doWord(r)}>
                    <FileText className="ml-1 h-4 w-4" /> Word
                  </Button>
                  {canManage && !r.case_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10"
                      onClick={() => convertToCase(r)}
                    >
                      <UserPlus className="ml-1 h-4 w-4" /> تحويل لملف طفل
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => (editingId === r.id ? cancel() : startEdit(r))}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {open[r.id] && editingId !== r.id && <StudyView study={r} />}

              {editingId === r.id && draft && (
                <div className="mt-3">
                  <StudyForm
                    draft={draft}
                    setDraft={setDraft}
                    setField={setField}
                    toggleTest={toggleTest}
                    specialists={specialists}
                    canPickSpecialist={canManage}
                    onSave={save}
                    onCancel={cancel}
                    saving={saving}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StudyView({ study }: { study: StudyRow }) {
  const d = study.data || {};
  const tests: string[] = Array.isArray(d.tests) ? d.tests : [];
  return (
    <div className="mt-3 space-y-3 text-sm">
      {SECTIONS.map((sec) => {
        const vals = sec.fields.filter((f) => d[sec.key]?.[f.key]);
        if (!vals.length) return null;
        return (
          <div key={sec.key}>
            <div className="mb-1 font-medium text-primary">{sec.title}</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {vals.map((f) => (
                <div key={f.key} className="rounded border bg-muted/30 px-2 py-1">
                  <span className="text-muted-foreground">{f.label}: </span>
                  <span className="whitespace-pre-wrap">{d[sec.key][f.key]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {(tests.length > 0 || d.tests_notes) && (
        <div>
          <div className="mb-1 font-medium text-primary">الاختبارات المرشح تطبيقها</div>
          <div className="rounded border bg-muted/30 px-2 py-1 whitespace-pre-wrap">
            {tests.join(" — ")}
            {d.tests_notes ? `\n${d.tests_notes}` : ""}
          </div>
        </div>
      )}
      {d.notes && (
        <div>
          <div className="mb-1 font-medium text-primary">ملاحظات</div>
          <div className="rounded border bg-muted/30 px-2 py-1 whitespace-pre-wrap">{d.notes}</div>
        </div>
      )}
    </div>
  );
}

function StudyForm({
  draft, setDraft, setField, toggleTest, specialists, canPickSpecialist, onSave, onCancel, saving,
}: {
  draft: StudyRow;
  setDraft: React.Dispatch<React.SetStateAction<StudyRow | null>>;
  setField: (s: string, f: string, v: string) => void;
  toggleTest: (t: string) => void;
  specialists: { id: string; full_name: string }[];
  canPickSpecialist: boolean;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const tests: string[] = Array.isArray(draft.data.tests) ? draft.data.tests : [];
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>اسم الطفل *</Label>
          <Input
            value={draft.child_name}
            onChange={(e) => setDraft((d) => (d ? { ...d, child_name: e.target.value } : d))}
          />
        </div>
        {canPickSpecialist && (
          <div>
            <Label>الأخصائي المسؤول</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.specialist_id || ""}
              onChange={(e) => setDraft((d) => (d ? { ...d, specialist_id: e.target.value || null } : d))}
            >
              <option value="">— بدون —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {SECTIONS.map((sec) => (
        <div key={sec.key} className="space-y-2">
          <div className="font-medium text-primary">{sec.title}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    rows={2}
                    value={draft.data[sec.key]?.[f.key] || ""}
                    onChange={(e) => setField(sec.key, f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    type={f.type === "date" ? "date" : "text"}
                    value={draft.data[sec.key]?.[f.key] || ""}
                    onChange={(e) => setField(sec.key, f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <div className="font-medium text-primary">الاختبارات المرشح تطبيقها</div>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED_TESTS.map((t) => {
            const on = tests.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTest(t)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <Textarea
          rows={2}
          placeholder="اختبارات أخرى / ملاحظات على الاختبارات"
          value={draft.data.tests_notes || ""}
          onChange={(e) => setDraft((d) => (d ? { ...d, data: { ...d.data, tests_notes: e.target.value } } : d))}
        />
      </div>

      <div className="space-y-2">
        <div className="font-medium text-primary">ملاحظات</div>
        <Textarea
          rows={3}
          value={draft.data.notes || ""}
          onChange={(e) => setDraft((d) => (d ? { ...d, data: { ...d.data, notes: e.target.value } } : d))}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          <Save className="ml-1 h-4 w-4" /> حفظ
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>إلغاء</Button>
      </div>
    </div>
  );
}
