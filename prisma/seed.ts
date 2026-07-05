import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@juridico-radar.local" },
    update: { onlyHighImpact: false },
    create: { email: "demo@juridico-radar.local", onlyHighImpact: false },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "demo-legal" },
    update: { name: "Demo Legal", dailyNotificationLimit: 25 },
    create: { name: "Demo Legal", slug: "demo-legal", dailyNotificationLimit: 25 },
  });

  await prisma.orgUserRole.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: { role: "owner" },
    create: { orgId: org.id, userId: user.id, role: "owner" },
  });

  const item = await prisma.item.upsert({
    where: { url: "https://www.dof.gob.mx/demo/juridico-radar-fiscal" },
    update: {
      summary: "Publicacion demo de alto impacto para validar dashboard, busqueda y alertas.",
      impacto: "alto",
      tipo: "ACUERDO",
      tema: "fiscal",
      category: "normativo",
    },
    create: {
      source: "DOF",
      sourceId: "demo-dof-fiscal-2026-06-15",
      title: "Acuerdo demo con cambios fiscales para contribuyentes",
      url: "https://www.dof.gob.mx/demo/juridico-radar-fiscal",
      canonicalUrl: "https://www.dof.gob.mx/demo/juridico-radar-fiscal",
      hash: "demo-hash-fiscal-2026-06-15",
      published: new Date("2026-06-15T12:00:00.000Z"),
      summary: "Publicacion demo de alto impacto para validar dashboard, busqueda y alertas.",
      impacto: "alto",
      tipo: "ACUERDO",
      tema: "fiscal",
      category: "normativo",
      keywordsHit: "fiscal,SAT,contribuyentes",
      raw: { demo: true, source: "seed" },
    },
  });

  await prisma.watchlist.upsert({
    where: {
      orgId_userId_type_value: {
        orgId: org.id,
        userId: user.id,
        type: "tema",
        value: "fiscal",
      },
    },
    update: { active: true },
    create: { orgId: org.id, userId: user.id, type: "tema", value: "fiscal" },
  });

  const document = await prisma.document.upsert({
    where: { canonicalKey: "DOF:demo-dof-fiscal-2026-06-15" },
    update: {
      title: item.title,
      summary: item.summary,
      status: "active",
    },
    create: {
      source: "DOF",
      jurisdiction: "MX",
      documentType: "ACUERDO",
      title: item.title,
      canonicalKey: "DOF:demo-dof-fiscal-2026-06-15",
      canonicalUrl: item.canonicalUrl,
      summary: item.summary,
    },
  });

  const version = await prisma.documentVersion.upsert({
    where: {
      documentId_contentHash: {
        documentId: document.id,
        contentHash: "demo-document-version-hash-001",
      },
    },
    update: {
      rawText: "Texto demo de una publicacion fiscal. Articulo 1. Se actualizan obligaciones informativas.",
      sourceItemId: item.id,
    },
    create: {
      documentId: document.id,
      versionLabel: "2026-06-15",
      publishedAt: item.published,
      effectiveFrom: item.published,
      contentHash: "demo-document-version-hash-001",
      rawRef: item.url,
      rawText: "Texto demo de una publicacion fiscal. Articulo 1. Se actualizan obligaciones informativas.",
      diffSummary: {
        bullets: ["Se agrega una obligacion informativa demo.", "Revisar transitorios y entrada en vigor."],
      },
      sourceItemId: item.id,
    },
  });

  const chunk = await prisma.documentChunk.upsert({
    where: {
      documentVersionId_chunkIndex: {
        documentVersionId: version.id,
        chunkIndex: 0,
      },
    },
    update: {
      text: "Articulo 1. Se actualizan obligaciones informativas para contribuyentes en el escenario demo.",
      tokenCount: 14,
    },
    create: {
      documentVersionId: version.id,
      chunkIndex: 0,
      sectionPath: "Articulo 1",
      article: "1",
      text: "Articulo 1. Se actualizan obligaciones informativas para contribuyentes en el escenario demo.",
      tokenCount: 14,
      citationAnchor: "articulo-1",
    },
  });

  await prisma.embedding.upsert({
    where: { chunkId_model: { chunkId: chunk.id, model: "demo-null-vector" } },
    update: {},
    create: { chunkId: chunk.id, model: "demo-null-vector" },
  });

  const rule = await prisma.alertRule.upsert({
    where: { id: "demo-alert-rule-fiscal" },
    update: {
      organizationId: org.id,
      userId: user.id,
      enabled: true,
    },
    create: {
      id: "demo-alert-rule-fiscal",
      organizationId: org.id,
      userId: user.id,
      name: "Cambios fiscales demo",
      ruleType: "topic",
      query: "fiscal",
      filters: { tema: "fiscal", impacto: "alto" },
      frequency: "daily",
    },
  });

  await prisma.notification.deleteMany({
    where: {
      alertRuleId: rule.id,
      organizationId: org.id,
      userId: user.id,
      documentVersionId: version.id,
      channel: "in_app",
    },
  });

  await prisma.notification.create({
    data: {
      alertRuleId: rule.id,
      organizationId: org.id,
      userId: user.id,
      documentVersionId: version.id,
      channel: "in_app",
      status: "queued",
      payload: {
        title: item.title,
        reasons: ["tema:fiscal", "impacto:alto"],
      },
    },
  });

  await prisma.processingJob.deleteMany({
    where: { queueName: "ingest", jobName: "seed-demo", type: "seed", source: "demo" },
  });

  await prisma.processingJob.create({
    data: {
      queueName: "ingest",
      jobName: "seed-demo",
      jobId: `seed-demo-${Date.now()}`,
      type: "seed",
      source: "demo",
      status: "completed",
      attempt: 1,
      payload: { demo: true },
      result: { itemId: item.id, documentId: document.id },
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      organizationId: org.id,
      userId: user.id,
      action: "seed.demo.created",
      entityType: "Document",
      entityId: document.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "seed.demo.created",
      entityType: "Document",
      entityId: document.id,
      metadata: { itemId: item.id, versionId: version.id },
    },
  });

  console.log(JSON.stringify({ ok: true, user: user.email, org: org.slug, itemId: item.id, documentId: document.id }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
