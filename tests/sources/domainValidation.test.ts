import { describe, it, expect } from "vitest";
import { validateDomainForSource, ALLOWED_DOMAINS } from "@/lib/sources/domainValidation";

describe("Domain Validation for Official Sources", () => {
  it("should block SENADO_WEB completely", () => {
    const result = validateDomainForSource(
      "SENADO_WEB",
      "https://senado.gob.mx/doc",
      "https://senado.gob.mx/doc"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("SENADO_WEB ingestion is temporarily disabled");
  });

  it("should allow valid domains for a configured source", () => {
    const result = validateDomainForSource(
      "DIPUTADOS",
      "https://www.diputados.gob.mx/Leyes",
      "https://diputados.gob.mx/Leyes"
    );
    expect(result.ok).toBe(true);
    expect(result.realDomain).toBe("diputados.gob.mx");
  });

  it("should block if initial URL domain is invalid", () => {
    const result = validateDomainForSource(
      "DIPUTADOS",
      "https://evil.com/Leyes",
      "https://www.diputados.gob.mx/Leyes"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Initial URL domain");
  });

  it("should block if final redirected URL domain is invalid", () => {
    const result = validateDomainForSource(
      "DIPUTADOS",
      "https://www.diputados.gob.mx/Leyes",
      "https://evil.com/redirect"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Final URL domain");
  });

  it("should allow if source is not in the allowlist (fallback / generic)", () => {
    const result = validateDomainForSource(
      "SOME_RANDOM_SOURCE",
      "https://google.com",
      "https://google.com"
    );
    expect(result.ok).toBe(true);
  });
  
  it("should block cross-source contaminations like senado to diputados", () => {
    // simulating an un-blocked SENADO_WEB or SENADO_GACETA that redirects to diputados
    const result = validateDomainForSource(
      "SENADO_GACETA",
      "https://senado.gob.mx",
      "https://diputados.gob.mx/LeyesBiblio"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not in allowlist for source SENADO_GACETA");
  });
});
