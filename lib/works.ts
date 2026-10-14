import { database } from "@/db/content";
import { getSessionUser, type AuthUser } from "@/lib/auth";
import { publicWork, type WorkQuestion } from "@/lib/work-bank";

import { WorkError } from "@/lib/work-error";
import { releasedDefinition } from "@/lib/work-catalog";
export { WorkError } from "@/lib/work-error";
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function fail(error: unknown) {
  if (error instanceof WorkError) return json({ error: error.message }, error.status);
  console.error("Work request failed", error);
  return json({ error: "Não foi possível acessar os trabalhos. Tente novamente." }, 503);
}
export async function actor(request: Request, role?: AuthUser["role"]) {
  const session = await getSessionUser(request);
  if (!session) throw new WorkError("Entre na sua conta para continuar.", 401);
  const user = await database().prepare("SELECT id,name,role,course_id FROM users WHERE id = ?").bind(session.id)
    .first<{ id: string; name: string; role: string; course_id: string | null }>();
  if (!user) throw new WorkError("Sua conta não está mais disponível.", 401);
  if (role && user.role !== role) throw new WorkError("Você não tem permissão para esta ação.", 403);
  return user;
}
export async function body(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new WorkError("Dados inválidos."); }
}
export function stringId(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 100) throw new WorkError("Identificador inválido.");
  return value;
}
export async function student(id: string) {
  const result = await database().prepare("SELECT id,name,course_id FROM users WHERE id = ? AND role = 'aluno'")
    .bind(id).first<{ id: string; name: string; course_id: string | null }>();
  if (!result) throw new WorkError("Aluno não encontrado.", 404);
  return result;
}
export async function studentAssignments(studentId: string) {
  const rows = await database().prepare(`SELECT a.*,
    (SELECT COUNT(*) FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NOT NULL) AS attempt_count,
    (SELECT MAX(score) FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NOT NULL) AS best_score,
    (SELECT score FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NOT NULL ORDER BY submitted_at DESC, rowid DESC LIMIT 1) AS latest_score,
    (SELECT submitted_at FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NOT NULL ORDER BY submitted_at DESC, rowid DESC LIMIT 1) AS latest_at,
    (SELECT id FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NULL LIMIT 1) AS active_attempt_id,
    (SELECT id FROM work_attempts t WHERE t.assignment_id=a.id AND t.submitted_at IS NOT NULL ORDER BY submitted_at DESC, rowid DESC LIMIT 1) AS latest_attempt_id
    FROM work_assignments a WHERE a.student_id=? ORDER BY a.released_at, a.id`).bind(studentId).all<{id: string; work_id: string; latest_score: number | null; attempt_count: number; definition_snapshot: string | null}>();
  return rows.results.map(({ definition_snapshot, ...row }) => ({ ...row, work: publicWork(releasedDefinition(row.work_id, definition_snapshot)) }));
}
export type Attempt = {
  id: string; assignment_id: string; work_id: string; student_id: string;
  questions: string; answers: string | null; score: number | null; total: number;
  started_at: string; submitted_at: string | null; definition_snapshot: string | null;
};
export async function ownedAttempt(id: string, studentId: string) {
  const attempt = await database().prepare(`SELECT t.*, a.work_id, a.student_id, a.definition_snapshot FROM work_attempts t
    JOIN work_assignments a ON a.id=t.assignment_id WHERE t.id=? AND a.student_id=?`)
    .bind(id, studentId).first<Attempt>();
  if (!attempt) throw new WorkError("Tentativa não encontrada.", 404);
  return attempt;
}
export function attemptView(attempt: Attempt) {
  const questions = JSON.parse(attempt.questions) as WorkQuestion[];
  const answers = attempt.answers ? JSON.parse(attempt.answers) as Record<string, number> : null;
  return {
    id: attempt.id, assignmentId: attempt.assignment_id,
    work: publicWork(releasedDefinition(attempt.work_id, attempt.definition_snapshot)), total: attempt.total,
    score: attempt.score, submittedAt: attempt.submitted_at,
    questions: questions.map(q => attempt.submitted_at
      ? { ...q, selected: answers?.[q.id] }
      : { id: q.id, prompt: q.prompt, options: q.options }),
  };
}
