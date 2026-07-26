type EnvSource = Record<string, string | undefined>;

const PLACEHOLDER_VALUES = new Set([
  "appass",
  "apppass",
  "change-me",
  "change-me-in-local-dev",
  "changeme",
  "dev-admin-token",
  "password",
  "postgres",
  "redis-secret",
  "replace-me",
  "replace-with-random-password",
  "replace-with-random-token",
  "secret",
]);

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function parseServiceUrl(
  name: "DATABASE_URL" | "REDIS_URL",
  value: string | undefined,
  protocols: string[],
  errors: string[],
): URL | null {
  if (!value?.trim()) {
    errors.push(`${name} es obligatoria en producción.`);
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) {
      errors.push(`${name} debe usar ${protocols.join(" o ")}.`);
      return null;
    }
    return parsed;
  } catch {
    errors.push(`${name} debe ser una URL válida.`);
    return null;
  }
}

export function getRuntimeEnvErrors(env: EnvSource = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  const databaseUrl = parseServiceUrl(
    "DATABASE_URL",
    env.DATABASE_URL,
    ["postgres:", "postgresql:"],
    errors,
  );
  const redisUrl = parseServiceUrl("REDIS_URL", env.REDIS_URL, ["redis:", "rediss:"], errors);

  if (databaseUrl) {
    const password = decodeURIComponent(databaseUrl.password || "");
    const usesKnownDefault =
      (databaseUrl.username === "app" && password === "apppass") ||
      (databaseUrl.username === "postgres" && password === "postgres");
    if (password.length < 12 || isPlaceholder(password) || usesKnownDefault) {
      errors.push("DATABASE_URL debe incluir credenciales PostgreSQL no predeterminadas y robustas.");
    }
  }

  if (redisUrl) {
    const password = decodeURIComponent(redisUrl.password || "");
    if (password.length < 12 || isPlaceholder(password)) {
      errors.push("REDIS_URL debe incluir una contraseña Redis robusta.");
    }
  }

  const adminToken = env.ADMIN_TOKEN?.trim() || "";
  if (adminToken.length < 32 || isPlaceholder(adminToken)) {
    errors.push("ADMIN_TOKEN debe ser un token aleatorio de al menos 32 caracteres.");
  }

  const publicUrl = env.NEXT_PUBLIC_APP_URL?.trim() || "";
  try {
    const parsed = new URL(publicUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("invalid protocol");
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL debe ser una URL HTTP(S) válida.");
  }

  return errors;
}

export function assertRuntimeEnv(env: EnvSource = process.env): void {
  const errors = getRuntimeEnvErrors(env);
  if (errors.length > 0) {
    throw new Error(`Configuración de producción inválida:\n- ${errors.join("\n- ")}`);
  }
}

