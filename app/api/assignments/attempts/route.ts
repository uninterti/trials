import { database } from "@/db/content";
import { gradeAnswers, shuffledQuestions, type WorkQuestion } from "@/lib/work-bank";
import { actor, attemptView, body, definition, fail, json, ownedAttempt, stringId, WorkError } from "@/lib/works";

export async function GET(request: Request) {
  try {
    const user = await actor(request, "aluno");
    return json(attemptView(await ownedAttempt(stringId(new URL(request.url).searchParams.get("id")), user.id)));
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const user = await actor(request, "aluno");
    const data = await body(request);
    const db = database();
    const assignment = await db.prepare("SELECT id,work_id FROM work_assignments WHERE id=? AND student_id=?")
      .bind(stringId(data.assignmentId), user.id).first<{id: string; work_id: string}>();
    if (!assignment) throw new WorkError("Este trabalho não está liberado para você.", 404);
    const work = definition(assignment.work_id);
    const previous = await db.prepare("SELECT questions FROM work_attempts WHERE assignment_id=? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC, rowid DESC LIMIT 1")
      .bind(assignment.id).first<{questions: string}>();
    const previousIds = previous ? (JSON.parse(previous.questions) as WorkQuestion[]).map(q => q.id) : [];
    const questions = shuffledQuestions(work.questions, previousIds);
    // Partial unique index makes duplicate starts resume the same active attempt.
    await db.prepare(`INSERT INTO work_attempts (id,assignment_id,work_version,questions,total,started_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(assignment_id) WHERE submitted_at IS NULL DO NOTHING`)
      .bind(crypto.randomUUID(), assignment.id, work.version, JSON.stringify(questions), questions.length, new Date().toISOString()).run();
    const active = await db.prepare("SELECT id FROM work_attempts WHERE assignment_id=? AND submitted_at IS NULL").bind(assignment.id).first<{id: string}>();
    if (!active) throw new WorkError("A tentativa foi concluída em outra aba. Atualize a lista.", 409);
    return json(attemptView(await ownedAttempt(active.id, user.id)));
  } catch (error) { return fail(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await actor(request, "aluno");
    const data = await body(request);
    const attempt = await ownedAttempt(stringId(data.attemptId), user.id);
    // Repeated submission returns the persisted grade; it never changes an answer.
    if (attempt.submitted_at) return json(attemptView(attempt));
    const questions = JSON.parse(attempt.questions) as WorkQuestion[];
    const score = gradeAnswers(questions, data.answers);
    if (score === null) throw new WorkError("Responda às 10 questões com uma alternativa válida em cada uma.");
    await database().prepare("UPDATE work_attempts SET answers=?,score=?,submitted_at=? WHERE id=? AND submitted_at IS NULL")
      .bind(JSON.stringify(data.answers), score, new Date().toISOString(), attempt.id).run();
    return json(attemptView(await ownedAttempt(attempt.id, user.id)));
  } catch (error) { return fail(error); }
}
