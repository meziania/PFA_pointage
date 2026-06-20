import crypto from "node:crypto";

export function generateTempPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;

  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
