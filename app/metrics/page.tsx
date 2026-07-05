import Link from "next/link";
import { computeMetricsRange } from "@/lib/metrics/compute";
import MetricsCharts from "@/app/metrics/MetricsCharts";

export const dynamic = "force-dynamic";

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setMonth(defaultFrom.getMonth() - 11);
  defaultFrom.setDate(1);

  const from = sp.from || defaultFrom.toISOString().slice(0, 10);
  const to = sp.to || now.toISOString().slice(0, 10);
  const data = await computeMetricsRange(new Date(from), new Date(to));
  const csvUrl = `/api/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1120, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <Link href="/" style={{ color: "#111", fontWeight: 700 }}>
            Volver
          </Link>
          <h1 style={{ fontSize: 28, margin: "10px 0 4px" }}>Analítica legal</h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Reformas por mes, tipo de cambio legal, temas y normas más modificadas.
          </p>
        </div>
        <a
          href={csvUrl}
          style={{
            minHeight: 44,
            padding: "10px 14px",
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #111",
            borderRadius: 6,
            color: "#fff",
            background: "#111",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Exportar CSV
        </a>
      </header>

      <form action="/metrics" method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Desde
          <input name="from" type="date" defaultValue={from} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
          Hasta
          <input name="to" type="date" defaultValue={to} style={inputStyle} />
        </label>
        <button style={buttonStyle}>Aplicar</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat label="Meses" value={data.monthlyReforms.length} />
        <Stat label="Cambios" value={data.monthlyReforms.reduce((sum, row) => sum + row.total, 0)} />
        <Stat label="Tipos" value={Object.keys(data.typeCounts).length} />
        <Stat label="Temas" value={Object.keys(data.topicCounts).length} />
      </div>

      <MetricsCharts data={data} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const inputStyle = {
  minHeight: 44,
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
} as const;

const buttonStyle = {
  alignSelf: "end",
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 6,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
} as const;
