import { describe, expect, it } from "vitest";
import {
  legalChangesHref,
  matchNormaDiffInsight,
  type NormaDiffCandidate,
} from "../../lib/monitoring/normaCoverage";

const candidates: NormaDiffCandidate[] = [
  {
    diffId: "diff-ccf",
    normaId: "norma-ccf",
    nombre: "Código Civil Federal",
    sigla: "CCF",
    aliases: ["Codigo Civil Federal"],
    summaryBullets: ["Se reformó el artículo 1916."],
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
  },
  {
    diffId: "diff-jalisco",
    normaId: "norma-ccjal",
    nombre: "Código Civil del Estado de Jalisco",
    sigla: "CCJAL",
    aliases: [],
    summaryBullets: ["Se modificó el artículo 405 Bis."],
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
  },
];

describe("matchNormaDiffInsight", () => {
  it("relaciona un Document con NormaDiff por sigla", () => {
    const result = matchNormaDiffInsight(
      { shortCode: "CCF", title: "Código Civil Federal" },
      candidates,
    );

    expect(result?.diffId).toBe("diff-ccf");
    expect(result?.summaryBullets).toEqual(["Se reformó el artículo 1916."]);
  });

  it("relaciona por título normalizado aunque cambien acentos y mayúsculas", () => {
    const result = matchNormaDiffInsight(
      { shortCode: null, title: "CODIGO CIVIL DEL ESTADO DE JALISCO" },
      candidates,
    );

    expect(result?.normaId).toBe("norma-ccjal");
  });

  it("conserva el enlace al NormaDiff aunque todavía no tenga summaryBullets", () => {
    const result = matchNormaDiffInsight(
      { shortCode: "CCom", title: "Código de Comercio" },
      [
        {
          diffId: "diff-vacio",
          normaId: "norma-ccom",
          nombre: "Código de Comercio",
          sigla: "CCom",
          aliases: [],
          summaryBullets: [],
          createdAt: new Date("2026-07-22T00:00:00.000Z"),
        },
      ],
    );

    expect(result?.diffId).toBe("diff-vacio");
    expect(result?.summaryBullets).toEqual([]);
  });
});

describe("legalChangesHref", () => {
  it("genera un enlace filtrado por sigla", () => {
    const insight = matchNormaDiffInsight(
      { shortCode: "CCF", title: "Código Civil Federal" },
      candidates,
    );

    expect(insight && legalChangesHref(insight)).toBe("/legal-hub/cambios?norma=CCF");
  });
});
