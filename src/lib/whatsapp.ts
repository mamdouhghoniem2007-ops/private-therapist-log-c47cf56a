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
  const timeTxt = opts.time.slice(0, 5);
  const lines = [
    `السلام عليكم، تذكير بموعد جلسة "${opts.caseName}".`,
    `📅 ${dateTxt}`,
    `🕐 الساعة ${timeTxt}`,
  ];
  if (opts.durationMinutes) lines.push(`⏱️ مدة الجلسة: ${opts.durationMinutes} دقيقة`);
  if (opts.sessionKindLabel) lines.push(`📌 ${opts.sessionKindLabel}`);
  if (opts.specialistName) lines.push(`👤 الأخصائي: ${opts.specialistName}`);
  lines.push("", "برجاء تأكيد الحضور. شكراً لكم — مركز رعاية.");
  return lines.join("\n");
}
