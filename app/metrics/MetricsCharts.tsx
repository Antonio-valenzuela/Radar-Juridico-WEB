"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CountMap = Record<string, number>;

export type MetricsPayload = {
  monthlyReforms: Array<{ month: string; total: number }>;
  typeCounts: CountMap;
  topicCounts: CountMap;
  topNormas: Array<{ normaId: string | null; nombre: string; sigla: string | null; count: number }>;
};

export default function MetricsCharts({ data }: { data: MetricsPayload }) {
  const typeData = Object.entries(data.typeCounts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
  const topicData = Object.entries(data.topicCounts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const normasData = data.topNormas.map((norma) => ({
    name: norma.sigla || trimName(norma.nombre),
    total: norma.count,
  }));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ChartBlock title="Reformas por mes">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.monthlyReforms}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" name="Reformas" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <ChartBlock title="Tipo de cambio legal">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name="Items" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>

        <ChartBlock title="Top 10 temas">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topicData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name="Cambios" fill="#9333ea" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>
      </div>

      <ChartBlock title="Top 10 normas más modificadas">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={normasData} layout="vertical" margin={{ left: 70 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip />
            <Bar dataKey="total" name="Versiones" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px", fontWeight: 800 }}>{title}</h2>
      {children}
    </section>
  );
}

function trimName(name: string) {
  return name.length > 24 ? `${name.slice(0, 24)}...` : name;
}
