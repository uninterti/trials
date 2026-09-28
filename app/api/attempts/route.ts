import { getSessionUser } from "@/lib/auth";
import { database, seedInitialContent } from "@/db/content";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Entre na sua conta para ver resultados." }, { status: 401 });
  try {
    await seedInitialContent();
    const result = await database().prepare("SELECT score,total,created_at FROM assessment_attempts WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 10").bind(user.id, "word").all();
    return Response.json({ attempts: result.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Attempt read failed", error);
    return Response.json({ error: "Resultados temporariamente indisponíveis." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Entre na sua conta para salvar a avaliação." }, { status: 401 });
  let answers: unknown;
  try { answers = (await request.json() as { answers?: unknown }).answers; } catch { return Response.json({ error: "Respostas inválidas." }, { status: 400 }); }
  if (!Array.isArray(answers) || answers.length !== 3 || !answers.every((item) => Number.isInteger(item) && item >= 0 && item <= 2)) {
    return Response.json({ error: "Responda às três perguntas." }, { status: 400 });
  }
  try {
    await seedInitialContent();
    const db = database();
    const result = await db.prepare("SELECT correct_option FROM questions WHERE course_id = ? ORDER BY sort_order").bind("word").all<{ correct_option: number }>();
    if (result.results.length !== answers.length) return Response.json({ error: "Avaliação indisponível." }, { status: 503 });
    const score = result.results.reduce((sum, question, index) => sum + Number(question.correct_option === answers[index]), 0);
    await db.prepare("INSERT INTO assessment_attempts (user_id,course_id,score,total,created_at) VALUES (?,?,?,?,?)").bind(user.id, "word", score, result.results.length, new Date().toISOString()).run();
    return Response.json({ score, total: result.results.length });
  } catch (error) {
    console.error("Attempt save failed", error);
    return Response.json({ error: "Não foi possível salvar sua avaliação. Tente novamente." }, { status: 503 });
  }
}
