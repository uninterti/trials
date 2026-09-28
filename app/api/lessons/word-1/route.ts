import { database, seedLessonOneContent } from "@/db/content";

export async function GET() {
  try {
    await seedLessonOneContent();
    const row = await database().prepare("SELECT content FROM lesson_content WHERE lesson_id = ?").bind("word-1").first<{ content: string }>();
    if (!row) return Response.json({ error: "Aula não encontrada." }, { status: 404 });
    return Response.json(JSON.parse(row.content), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lesson content read failed", error);
    return Response.json({ error: "A aula está temporariamente indisponível." }, { status: 503 });
  }
}
