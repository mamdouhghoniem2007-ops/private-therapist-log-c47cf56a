import { fmtTime12 } from "@/lib/utils";

export function waLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatAppointmentMessage(opts: {
  caseName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM[:SS]
  durationMinutes?: number | null;
  specialistName?: string | null;
  sessionKindLabel?: string | null;
  cost?: number | null;
  discountPercentage?: number | null;
}): string {
  const d = new Date(opts.date);
  const dateTxt = isNaN(d.getTime())
    ? opts.date
    : d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeTxt = fmtTime12(opts.time);
  const lines = [
    `📋 *تأكيد موعد جلسة — ${opts.caseName}*`,
    ``,
    `السلام عليكم ورحمة الله وبركاته،`,
    `نؤكد لحضرتكم موعد الجلسة بإذن الله:`,
    ``,
    `📅 *اليوم:* ${dateTxt}`,
    `🕐 *الساعة:* ${timeTxt}`,
  ];
  if (opts.specialistName) lines.push(`👤 *الأخصائي:* ${opts.specialistName}`);
  if (opts.durationMinutes) lines.push(`⏱️ *مدة الجلسة:* ${opts.durationMinutes} دقيقة`);
  lines.push(`📌 *نوع الجلسة:* ${opts.sessionKindLabel || "جلسة"}`);

  const cost = Number(opts.cost ?? 0);
  const disc = Number(opts.discountPercentage ?? 0);
  if (cost > 0) {
    const net = Math.round(cost * (1 - disc / 100) * 100) / 100;
    if (disc > 0) {
      lines.push(`💰 *السعر:* ${cost} ج`);
      lines.push(`🏷️ *الخصم:* ${disc}%`);
      lines.push(`✅ *المبلغ المستحق:* ${net} ج`);
    } else {
      lines.push(`💰 *السعر:* ${net} ج`);
    }
  }

  lines.push(
    "",
    `🔔 *نرجو الالتزام بالموعد المحدد، حيث إن أي تأخير يؤثر على باقي الحالات المقررة خلال اليوم.*`,
    "",
    `شاكرين لحضرتكم حسن التعاون 🤝`,
    `— مركز رعاية`,
  );
  return lines.join("\n");
}


export function formatAbsenceWarningMessage(opts: {
  caseName: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  absenceCount?: number | null; // إجمالي مرات الغياب (بما فيها اليوم)
  specialistName?: string | null;
}): string {
  const d = new Date(opts.date);
  const dateTxt = isNaN(d.getTime())
    ? opts.date
    : d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeTxt = opts.time ? fmtTime12(opts.time) : "";
  const count = Number(opts.absenceCount || 0);
  const repeated = count >= 2;

  const lines = [
    `⚠️ *تنبيه غياب — ${opts.caseName}*`,
    ``,
    `السلام عليكم ورحمة الله وبركاته،`,
    `نودّ إعلامكم بأن الطفل *${opts.caseName}* لم يحضر جلسته المقررة:`,
    ``,
    `📅 *اليوم:* ${dateTxt}`,
  ];
  if (timeTxt) lines.push(`🕐 *الساعة:* ${timeTxt}`);
  if (opts.specialistName) lines.push(`👤 *الأخصائي:* ${opts.specialistName}`);
  if (count > 0) {
    lines.push(``, `📊 *إجمالي مرات الغياب حتى الآن:* ${count}`);
  }
  lines.push(
    ``,
    repeated
      ? `نلفت انتباه حضرتكم إلى أن *تكرار الغياب* يؤثر بشكل مباشر على تقدّم الحالة وانتظام الخطة العلاجية للطفل، وقد يُبطئ من ظهور النتائج المرجوّة من الجلسات.`
      : `نلفت انتباه حضرتكم إلى أن *الغياب المتكرر* عن الجلسات يؤثر على تقدّم الحالة وانتظام الخطة العلاجية للطفل.`,
    ``,
    `🔔 برجاء *الالتزام بالمواعيد* أو *الاعتذار مسبقًا* حال وجود أي ظرف، حتى نتمكن من إعادة جدولة الجلسة وإتاحة الوقت لحالة أخرى.`,
    ``,
    `في حال وجود أي استفسار أو رغبة في تغيير الموعد، نرجو التواصل معنا.`,
    ``,
    `شاكرين لحضرتكم حسن التعاون 🤝`,
    `— مركز رعاية`,
  );
  return lines.join("\n");
}

