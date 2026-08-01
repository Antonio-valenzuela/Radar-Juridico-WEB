import { prisma } from "@/lib/prisma";
import DocumentsCatalog from "@/components/documents/DocumentsCatalog";
import { isPubliclySearchableQuality } from "@/lib/ingest/quality";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const items = await prisma.item.findMany({
    where: { category: { not: "ruido" } },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  const validItems = items.filter(item => isPubliclySearchableQuality(item.raw)).slice(0, 100);

  // Map backend prisma dates to Date objects cleanly for client
  const mapped = validItems.map(item => ({
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
