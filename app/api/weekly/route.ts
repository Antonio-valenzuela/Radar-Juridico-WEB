import { NextResponse } from "next/server";
import { getWeeklyComparison } from "@/lib/weekly";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const data = await getWeeklyComparison();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message || String(error) },
            { status: 500 }
        );
    }
}
