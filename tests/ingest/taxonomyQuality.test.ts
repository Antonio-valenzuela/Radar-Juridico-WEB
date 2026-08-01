import { describe, it, expect } from "vitest";
import { filterNoise, resolveTaxonomy, normalizeRawItem } from "@/lib/ingest/normalize";
import type { RawSourceItem } from "@/lib/sources/types";

describe("Taxonomy and Quality - Unit tests", () => {
  describe("filterNoise", () => {
    it("should remove navigation menus", () => {
      const input = "Inicio | Contacto | Ayuda Esto es el contenido real";
      expect(filterNoise(input)).toBe("Esto es el contenido real");
    });

    it("should remove portal footers and headers", () => {
      const input = "Derechos Reservados 2026. Texto válido.";
      expect(filterNoise(input)).toBe("2026. Texto válido.");
    });

    it("should remove HTML error/login responses", () => {
      const input = "404 Not Found Please login to continue El verdadero texto";
      expect(filterNoise(input)).toBe("El verdadero texto");
    });
  });

  describe("resolveTaxonomy", () => {
    it("should assign exact match taxonomy", () => {
      expect(resolveTaxonomy("Constitución")).toBe("Constitución");
      expect(resolveTaxonomy("acuerdo ")).toBe("Acuerdo");
    });

    it("should fallback to 'Revisión requerida' when rawTipo is LEY or Vigente without evidence", () => {
      expect(resolveTaxonomy("LEY", false)).toBe("Revisión requerida");
      expect(resolveTaxonomy("Vigente", false)).toBe("Revisión requerida");
    });

    it("should allow 'Ley' if it has verifiable evidence", () => {
      expect(resolveTaxonomy("LEY", true)).toBe("Ley");
    });

    it("should extract known taxonomy from longer strings", () => {
      expect(resolveTaxonomy("acuerdo por el que se expide...")).toBe("Acuerdo");
      expect(resolveTaxonomy("resolución miscelánea")).toBe("Resolución");
      expect(resolveTaxonomy("norma oficial mexicana nom-001")).toBe("Norma oficial");
    });

    it("should return 'Sin clasificar' for unknown types", () => {
      expect(resolveTaxonomy("Algún texto raro")).toBe("Sin clasificar");
      expect(resolveTaxonomy(null)).toBe("Sin clasificar");
    });
  });

  describe("normalizeRawItem", () => {
    it("should apply noise filter and taxonomy resolution correctly", () => {
      const rawItem: RawSourceItem = {
        source: "DOF",
        sourceId: "123",
        title: "Inicio | Contacto | Ayuda LEY de ingresos",
        url: "http://example.com/1",
        published: new Date("2026-08-01"),
        tipo: "LEY",
        qualityStatus: "valid"
      };

      const normalized = normalizeRawItem(rawItem);
      expect(normalized.title).toBe("LEY de ingresos");
      expect(normalized.tipo).toBe("Ley");
    });

    it("should reject 'LEY' default if not valid quality", () => {
      const rawItem: RawSourceItem = {
        source: "DOF",
        sourceId: "124",
        title: "LEY de algo",
        url: "http://example.com/2",
        published: new Date("2026-08-01"),
        tipo: "LEY"
        // no qualityStatus
      };

      const normalized = normalizeRawItem(rawItem);
      expect(normalized.title).toBe("LEY de algo");
      expect(normalized.tipo).toBe("Revisión requerida");
    });
  });
});
