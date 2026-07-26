import { NextResponse } from "next/server";
import { checkCoreReadiness } from "@/lib/health/checks";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkCoreReadiness();
  return NextResponse.json(
    {
      ...result,
      service: "juridico-radar",
      checkedAt: new Date().toISOString(),
    },
    { status: result.ok ? 200 : 503 },
  );
}

