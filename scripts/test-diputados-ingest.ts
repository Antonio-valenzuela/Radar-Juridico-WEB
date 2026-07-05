import { fetchItems } from "../lib/sources/diputados";

async function main() {
  const result = await fetchItems({ source: "DIPUTADOS", limit: 20 });
  console.log(JSON.stringify({
    ok: result.ok,
    found: result.found,
    errors: result.errors,
    first10: result.items.slice(0, 10).map((item) => ({
      title: item.title,
      url: item.url,
      tema: item.tema,
      tipo: item.tipo,
    })),
  }, null, 2));

  if (!result.ok || result.found === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[test-diputados-ingest] failed", error);
  process.exit(1);
});
