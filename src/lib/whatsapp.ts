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
  if (opts.sessionKindLabel) lines.push(`📌 *نوع الجلسة:* ${opts.sessionKindLabel}`);
  lines.push(
    "",
    `🔔 *نرجو الالتزام بالموعد المحدد، حيث إن أي تأخير يؤثر على باقي الحالات المقررة خلال اليوم.*`,
    "",
    `شاكرين لحضرتكم حسن التعاون 🤝`,
    `— مركز رعاية`,
  );
  return lines.join("\n");
}
