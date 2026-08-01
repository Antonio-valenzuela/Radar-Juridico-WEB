import { describe, expect, it, vi } from "vitest";
import {
  buildJaliscoItemsFromDetail,
  fetchJaliscoOfficialItems,
  parseJaliscoPublicationEntries,
} from "@/lib/ingest/jaliscoOficial";
import { DEFAULT_MONITORED_DOCUMENTS } from "@/lib/monitoring/monitoredDocuments";

const description =
  "DECRETO 30194/LXIV/26 del Congreso del Estado que reforma el artículo 34 del Código Penal para el Estado Libre y Soberano de Jalisco. - 10 " +
  "DECRETO 30196/LXIV/26 del Congreso del Estado que reforma diversos artículos del Código Civil del Estado de Jalisco. - 16";

describe("Periódico Oficial de Jalisco", () => {
  it("separa el sumario oficial en publicaciones con identificador y página", () => {
    expect(parseJaliscoPublicationEntries(description)).toEqual([
      {
        identifier: "30194-LXIV-26",
        page: 10,
        title:
          "DECRETO 30194/LXIV/26 del Congreso del Estado que reforma el artículo 34 del Código Penal para el Estado Libre y Soberano de Jalisco.",
      },
      {
        identifier: "30196-LXIV-26",
        page: 16,
        title:
          "DECRETO 30196/LXIV/26 del Congreso del Estado que reforma diversos artículos del Código Civil del Estado de Jalisco.",
      },
    ]);
  });

  it("crea items distintos para los códigos Penal y Civil con jurisdicción estatal", () => {
    const items = buildJaliscoItemsFromDetail(
      {
        id: 25317,
        post_date: "2026-06-18",
        volume: "CDXVII",
        number: "4",
        description,
        section: "VII",
        link:
          "https://apiperiodico.jalisco.gob.mx/api/newspaper/getAsset?q=newspaper/25317/edicion.pdf",
      },
      {
        10: "DECRETO 30194. Artículo único. Se reforma el artículo 34 del Código Penal.",
        16: "DECRETO 30196. Artículo primero. Se reforma el Código Civil del Estado de Jalisco.",
      }
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.sourceId)).toEqual([
      "25317:30194-LXIV-26",
      "25317:30196-LXIV-26",
    ]);
    expect(items[0].url).toContain("&item=25317%3A30194-LXIV-26");
    expect(items[0].raw?.normaOverride).toMatchObject({
      sigla: "CPJAL",
      fuente: "PERIODICO_OFICIAL_JALISCO",
    });
    expect(items[1].raw?.normaOverride).toMatchObject({
      sigla: "CCJAL",
      fuente: "PERIODICO_OFICIAL_JALISCO",
    });
    expect(items[1].raw?.jurisdiction).toBe("Jalisco");
  });

  it("consulta el API oficial por fecha mediante el fetch con timeout compartido", async () => {
    const fetchOfficial = vi.fn(async (url: string) => {
      if (url.includes("/newspaper/public/find")) {
        return {
          tlsRelaxed: false,
          response: Response.json({
            errors: false,
            status_code: 200,
            result: {
              id: 25317,
              post_date: "2026-06-18",
              volume: "CDXVII",
              number: "4",
              description,
              section: "VII",
              link:
                "https://apiperiodico.jalisco.gob.mx/api/newspaper/getAsset?q=newspaper/25317/edicion.pdf",
            },
          }),
        };
      }

      return {
        tlsRelaxed: false,
        response: Response.json({
          errors: false,
          status_code: 200,
          result: {
            current_page: 1,
            last_page: 1,
            data: [
              {
                id_newspaper: 25317,
                description,
                date_newspaper: "2026-06-18",
                section: "VII",
                special: false,
                special_description: null,
                tomo: "CDXVII",
                number: "4",
              },
            ],
          },
        }),
      };
    });

    const result = await fetchJaliscoOfficialItems(
      { source: "PERIODICO_OFICIAL_JALISCO", days: 1 },
      {
        now: () => new Date("2026-06-18T18:00:00.000Z"),
        fetchOfficial,
        extractPdfPages: async () => ({}),
      }
    );

    expect(result.ok).toBe(true);
    expect(result.found).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(fetchOfficial).toHaveBeenCalledTimes(2);
    expect(fetchOfficial.mock.calls[0][0]).toContain("fecha=2026-06-18");
  });

  it("incluye los códigos estatales en el monitoreo con jurisdicción Jalisco", () => {
    const stateCodes = DEFAULT_MONITORED_DOCUMENTS.filter(
      (document) => document.jurisdiction === "Jalisco"
    );

    expect(stateCodes.map((document) => document.shortCode)).toEqual(["CCJAL", "CPJAL"]);
    expect(stateCodes.every((document) => document.officialUrl.includes("congresojal.gob.mx"))).toBe(true);
  });
});
