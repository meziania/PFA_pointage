/** Fuseau horaire métier — Maroc (Casablanca). */
export const BUSINESS_TIMEZONE = "Africa/Casablanca";

export function getMoroccoNowParts(at = new Date()): { ymd: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hm: `${get("hour")}:${get("minute")}`,
  };
}

export function moroccoYmdDaysAgo(days: number, at = new Date()): string {
  const { ymd } = getMoroccoNowParts(at);
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
