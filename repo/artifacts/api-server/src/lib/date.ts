/**
 * تاريخ "اليوم" بتوقيت مكة المكرمة مع بدء اليوم عند الساعة 5 صباحاً.
 *
 * مكة = UTC+3، واليوم يبدأ الساعة 5 صباحاً مكةً.
 * أي: ما قبل الساعة 5 صباحاً مكةً يُحسب ضمن اليوم السابق.
 */
export function getMakkahDay(): string {
  const meccaMs = Date.now() + 3 * 60 * 60 * 1000; // UTC+3
  const d = new Date(meccaMs);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1); // قبل 5 صباحاً = ما زلنا في الأمس
  return d.toISOString().slice(0, 10);
}

/**
 * تاريخ من X أيام مضت بتوقيت مكة (مع نفس منطق 5 صباحاً).
 */
export function getMakkahDaysAgo(days: number): string {
  const meccaMs = Date.now() + 3 * 60 * 60 * 1000;
  const d = new Date(meccaMs);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** بداية الأسبوع الحالي (الأحد) بتوقيت مكة */
export function getMakkahWeekStart(): string {
  const meccaMs = Date.now() + 3 * 60 * 60 * 1000;
  const d = new Date(meccaMs);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // الأحد = 0
  return d.toISOString().slice(0, 10);
}

/** بداية الأسبوع الماضي (الأحد السابق) بتوقيت مكة */
export function getMakkahLastWeekStart(): string {
  const meccaMs = Date.now() + 3 * 60 * 60 * 1000;
  const d = new Date(meccaMs);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() - 7);
  return d.toISOString().slice(0, 10);
}

/** نهاية الأسبوع الماضي (السبت) بتوقيت مكة */
export function getMakkahLastWeekEnd(): string {
  const meccaMs = Date.now() + 3 * 60 * 60 * 1000;
  const d = new Date(meccaMs);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() - 1);
  return d.toISOString().slice(0, 10);
}
