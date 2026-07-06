import { prisma } from "@/lib/prisma";
import DocumentsCatalog from "@/components/documents/DocumentsCatalog";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const items = await prisma.item.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  // Map backend prisma dates to Date objects cleanly for client
  const mapped = items.map(item => ({
    id: item.id,
    title: item.title,
    url: item.url,
    published: item.published,
    source: item.source,
    tipo: item.tipo,
    tema: item.tema,
    impacto: item.impacto,
    summary: item.summary,
    createdAt: item.createdAt,
  }));

  return <DocumentsCatalog initialItems={mapped} />;
}
