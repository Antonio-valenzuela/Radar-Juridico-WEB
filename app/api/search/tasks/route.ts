import { NextResponse } from 'next/server';
import { TASK_TAXONOMY } from '@/lib/tasks/taskTaxonomy';

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      tasks: TASK_TAXONOMY.map(t => ({
        id: t.id,
        label: t.label,
        description: t.description,
        matter: t.matter,
        keywords: t.keywords,
        entities: t.entities,
        sectors: t.sectors
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
