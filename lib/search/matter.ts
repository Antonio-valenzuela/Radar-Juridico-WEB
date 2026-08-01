export function normalizeMatterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function matchesMatter(value: unknown, matter: string): boolean {
  const target = matter.trim().toLowerCase();
  if (!target) return true;

  return normalizeMatterValues(value).some((entry) => entry.toLowerCase() === target);
}
