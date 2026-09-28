import { database, seedInitialContent } from "@/db/content";

export async function GET() {
  try {
    await seedInitialContent();
    const db = database();
    const [courses, lessons, questions] = await Promise.all([
      db.prepare("SELECT id,title,description,status,icon FROM courses ORDER BY sort_order").all(),
      db.prepare("SELECT id,course_id,title,goal,blocks,task,duration_minutes FROM lessons ORDER BY course_id,sort_order").all(),
      db.prepare("SELECT id,course_id,prompt,options FROM questions ORDER BY course_id,sort_order").all(),
    ]);
    return Response.json({
      courses: courses.results,
      lessons: lessons.results.map((row) => ({ ...row, blocks: JSON.parse(String(row.blocks)) })),
      questions: questions.results.map((row) => ({ ...row, options: JSON.parse(String(row.options)) })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catalog read failed", error);
    return Response.json({ error: "Conteúdo temporariamente indisponível." }, { status: 503 });
  }
}
