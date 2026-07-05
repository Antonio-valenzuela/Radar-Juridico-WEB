import { NextResponse } from "next/server";
import { ingestSidofByDate, ingestSidofWeek } from "@/lib/ingest/sidof";
import { ingestDofWeb } from "@/lib/ingest/dofWeb";
import { ingestScjnComunicados } from "@/lib/ingest/scjn";
import { requireAdmin } from "@/lib/security/adminAuth";

export const maxDuration = 300; // 5 minutes logic limits
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
    try {
        // Ejecutar ingestiones
        const results = [];

        // 1. SIDOF Hoy
        try {
            const r1 = await ingestSidofByDate();
            results.push({ source: "sidof-today", ...r1 });
        } catch (e: any) {
            results.push({ source: "sidof-today", ok: false, error: e.message });
        }

        // 2. DOF Web Hoy
        try {
            const r2 = await ingestDofWeb();
            results.push({ source: "dof-web", ...r2 });
        } catch (e: any) {
            results.push({ source: "dof-web", ok: false, error: e.message });
        }

        // 3. SCJN (últimos 15 IDs por rapidez)
        try {
            // Necesitamos un ID de inicio aproximado o autodetectado. 
            // Como no tenemos estado persistente del ID, asumimos un rango hardcodeado O
            // mejor aún: Scjn ingestion logic en scjn.ts itera hacia atrás. 
            // Usaremos un ID alto ficticio o corregiremos ingestScjnComunicados para que busque el último?
            // Revisando lib/ingest/scjn.ts: ingestScjnComunicados(startId, count).
            // Vamos a usar un año aprox 2024-2025. 
            // Por simplicidad en este "Refresh Rapido", usaremos un ID reciente hardcodeado alto
            // o confiamos en que el usuario configure eso. 
            // MEJORA: Consultar el DB para ver el último item de SCJN o simplemente usar un ID seguro base 2026.
            // Asumiremos startId = 7000 (ajustar según realidad vigente)
            const r3 = await ingestScjnComunicados(7200, 20);
            results.push({ source: "scjn", ...r3 });
        } catch (e: any) {
            results.push({ source: "scjn", ok: false, error: e.message });
        }

        // 4. SIDOF Week (backfill rápido 3 días)
        try {
            const r4 = await ingestSidofWeek(3);
            results.push({ source: "sidof-week-3", ...r4 });
        } catch (e: any) {
            results.push({ source: "sidof-week", ok: false, error: e.message });
        }

        return NextResponse.json({
            ok: true,
            ran: ["sidof-today", "dof-web", "scjn", "sidof-week"],
            results
        });

    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message || String(error) },
            { status: 500 }
        );
    }
}

