export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** "BRA 215" → "215"; usado para casar números digitados */
export const sailDigits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
