import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test", LLM_PROVIDER: "local" },
      timeout: 15_000,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  try {
    return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
  } catch {
    throw new Error("Invalid JSON returned: " + result.stdout);
  }
}

test("POST /api/legal-reports y GET /api/legal-reports", () => {
  const res = runTs(`
    import { POST, GET } from "./app/api/legal-reports/route";
    import { NextRequest } from "next/server";
    import { prisma } from "./lib/prisma";

    (async () => {
      // 1. POST - Create job
      const postReq = new NextRequest("http://localhost/api/legal-reports", {
        method: "POST",
        headers: { "x-admin-token": "dev-admin-token" },
        body: JSON.stringify({
          query: "reforma amparo 2026",
          materia: "constitucional",
          fuente: "DOF",
          localResults: []
        })
      });
      const postRes = await POST(postReq);
      const postData = await postRes.json();

      // 2. GET - List reports
      const getReq = new NextRequest("http://localhost/api/legal-reports?limit=5", {
        method: "GET",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      const getRes = await GET(getReq);
      const getData = await getRes.json();

      // Clean up the created test job
      if (postData.id) {
        await prisma.processingJob.delete({ where: { id: postData.id } }).catch(() => {});
      }

      console.log(JSON.stringify({
        postOk: postData.ok,
        postId: postData.id,
        postStatus: postData.status,
        getOk: getData.ok,
        listLength: getData.reports?.length ?? 0
      }));
      process.exit(0);
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(res.postOk, true, "POST should respond successfully");
  assert.ok(res.postId, "POST response should contain a job ID");
  assert.equal(res.postStatus, "queued", "Job should start in queued state");
  assert.equal(res.getOk, true, "GET list should respond successfully");
});

test("GET /api/legal-reports/[id] con etapas de progreso", () => {
  const res = runTs(`
    import { GET as getById } from "./app/api/legal-reports/[id]/route";
    import { NextRequest } from "next/server";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Create a mock ProcessingJob directly in DB
      const job = await prisma.processingJob.create({
        data: {
          queueName: "legal-reports",
          jobName: "legal-report",
          type: "LEGAL_REPORT",
          status: "PROCESSING",
          stage: "analyzing",
          progress: 65,
          payload: { query: "test query" }
        }
      });

      const getReq = new NextRequest("http://localhost/api/legal-reports/" + job.id, {
        method: "GET",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      
      const params = Promise.resolve({ id: job.id });
      const getRes = await getById(getReq, { params });
      const getData = await getRes.json();

      // Clean up
      await prisma.processingJob.delete({ where: { id: job.id } }).catch(() => {});

      console.log(JSON.stringify({
        getOk: getData.ok,
        status: getData.status,
        stage: getData.stage,
        progress: getData.progress,
        statusLabel: getData.statusLabel,
      }));
      process.exit(0);
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(res.getOk, true, "GET report by ID should return ok");
  assert.equal(res.status, "PROCESSING", "Should return the DB status");
  assert.equal(res.stage, "analyzing", "Should return the DB stage");
  assert.equal(res.progress, 65, "Should return the exact progress percentage");
  assert.equal(res.statusLabel, "Analizando", "Should map stage 'analyzing' to 'Analizando'");
});

test("Worker processLegalReport ejecuta busquedas, IA y serializa JSON-safe", () => {
  const res = runTs(`
    import { prisma } from "./lib/prisma";
    import { Connection } from "bullmq";

    // Spawning a mock run of worker logic
    (async () => {
      // Create mock job in DB
      const jobRecord = await prisma.processingJob.create({
        data: {
          queueName: "legal-reports",
          jobName: "legal-report",
          type: "LEGAL_REPORT",
          status: "QUEUED",
          stage: "queued",
          progress: 5,
          payload: { query: "consulta test de amparo fiscal" }
        }
      });

      // We dynamically load the worker processor function to invoke it
      // we pass a mock BullMQ Job
      const { processLegalReport } = await import("./worker/legalReportWorker");
      
      const mockJob = {
        data: {
          processingJobId: jobRecord.id,
          query: "consulta test de amparo fiscal",
          filters: {},
        },
        updateProgress: async (p) => {}
      };

      // Execute processor
      const result = await processLegalReport(mockJob);

      // Fetch finished job from DB
      const finishedJob = await prisma.processingJob.findUnique({
        where: { id: jobRecord.id }
      });

      // Clean up
      await prisma.processingJob.delete({ where: { id: jobRecord.id } }).catch(() => {});
      
      // Explicitly disconnect prisma to prevent libuv handles crash on Windows
      await prisma.$disconnect();

      console.log(JSON.stringify({
        status: finishedJob?.status,
        stage: finishedJob?.stage,
        progress: finishedJob?.progress,
        hasResumen: !!result.resumenEjecutivo,
        hasDocumentos: Array.isArray(result.documentosEncontrados),
        trazabilidadQuery: result.trazabilidad?.query
      }));
      
      // Delay exit slightly to let connections close cleanly
      setTimeout(() => process.exit(0), 200);
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(res.status, "COMPLETED", "Worker should mark job status as COMPLETED");
  assert.equal(res.stage, "completed", "Worker should update stage to completed");
  assert.equal(res.progress, 100, "Worker should update progress to 100");
  assert.equal(res.hasResumen, true, "Result should contain resumenEjecutivo");
  assert.equal(res.hasDocumentos, true, "Result should contain documentosEncontrados array");
  assert.equal(res.trazabilidadQuery, "consulta test de amparo fiscal", "Trazabilidad should match the original query");
});
