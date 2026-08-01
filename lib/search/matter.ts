export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  }

  return [];
}

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

export function matchesMatter(value: unknown, matter: unknown): boolean {
  const targets = normalizeMatterValues(matter).map((entry) => entry.toLowerCase());

  // An empty string is the legacy representation of an unfiltered matter.
  // Other invalid values must never broaden a filter or throw at runtime.
  if (targets.length === 0) return typeof matter === "string" && matter.trim() === "";

  const values = normalizeMatterValues(value).map((entry) => entry.toLowerCase());
  return targets.some((target) => values.includes(target));
}
