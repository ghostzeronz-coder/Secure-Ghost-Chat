export function normalizeAlias(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^\w\-]/g, "");
}
