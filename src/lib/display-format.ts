/** Preserve accents; standardize case without changing stored personal names. */
export function formatDoctorDisplayName(value?: string | null): string {
  return (value ?? "").trim().replace(/^(?:bs\.?|bác sĩ|dr\.?)\s+/iu, "")
    .replace(/\s+/g, " ").toLocaleLowerCase("vi-VN")
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("vi-VN"));
}

export function formatStableSection(value?: string | null): string {
  const name = (value ?? "").trim().replace(/^(?:(?:khu|stable)\s+)+/iu, "");
  return name ? `Khu ${name}` : "Khu chuồng chung";
}

export function formatDisplayDate(value?: string | null, includeTime = false): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}
