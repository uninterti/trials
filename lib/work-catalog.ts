import { database } from "@/db/content";
import { workDefinitions, type WorkQuestion } from "@/lib/work-bank";
import { WorkError } from "@/lib/work-error";
import { workCourses, workLevels, questionInput, workInput, type CourseId, type WorkLevel } from "@/lib/work-input";

export type CatalogQuestion = WorkQuestion & { courseId: CourseId; level: WorkLevel; revision: string };
export type CatalogWork = {
  id: string; courseId: string; courseTitle: string; level?: string;
  lessonId?: string; lessonTitle: string; title: string; version: number;
  revision?: string; questions: WorkQuestion[];
};
type QuestionRow = { id: string; course_id: CourseId; level: WorkLevel; prompt: string; options: string; correct: number; explanation: string; revision: string };
type WorkRow = { id: string; course_id: CourseId; level: WorkLevel; title: string; lesson_title: string; version: number; revision: string };

// One-time, idempotent data seed; schema is owned exclusively by migrations.
// Version zero is used only inside this atomic batch to protect concurrent first loads.
export async function seedWorkCatalog() {
  const db = database();
  if (await db.prepare("SELECT id FROM managed_works WHERE id='W-A1' AND version>0").first()) return;
  const work = workDefinitions[0];
  const now = new Date().toISOString();
  await db.batch([
    ...work.questions.map(q => db.prepare(`INSERT INTO question_bank (id,course_id,level,prompt,options,correct,explanation,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(q.id, work.courseId, "facil", q.prompt, JSON.stringify(q.options), q.correct, q.explanation, crypto.randomUUID(), now, now)),
    db.prepare(`INSERT INTO managed_works (id,course_id,level,title,lesson_title,version,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,0,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(work.id, work.courseId, "facil", work.title, work.lessonTitle, crypto.randomUUID(), now, now),
    ...work.questions.map((q, i) => db.prepare(`INSERT INTO managed_work_questions (work_id,question_id,position)
      SELECT id,?,? FROM managed_works WHERE id=? AND version=0 ON CONFLICT DO NOTHING`).bind(q.id, i, work.id)),
    db.prepare("UPDATE managed_works SET version=1 WHERE id=? AND version=0").bind(work.id),
  ]);
}
function mapQuestion(row: QuestionRow): CatalogQuestion {
  return { id: row.id, courseId: row.course_id, level: row.level, prompt: row.prompt, options: JSON.parse(row.options), correct: row.correct, explanation: row.explanation, revision: row.revision };
}
export async function listBankQuestions() {
  const rows = await database().prepare("SELECT * FROM question_bank ORDER BY created_at DESC,id").all<QuestionRow>();
  return rows.results.map(mapQuestion);
}
export async function listCatalogWorks(): Promise<CatalogWork[]> {
  // One joined query sees work metadata and associations from the same DB snapshot.
  const rows = await database().prepare(`SELECT w.*, q.id AS q_id, q.course_id AS q_course_id, q.level AS q_level,
    q.prompt,q.options,q.correct,q.explanation,q.revision AS q_revision
    FROM managed_works w LEFT JOIN managed_work_questions l ON l.work_id=w.id
    LEFT JOIN question_bank q ON q.id=l.question_id ORDER BY w.created_at DESC,w.id,l.position`)
    .all<WorkRow & {q_id: string | null; q_course_id: CourseId; q_level: WorkLevel; prompt: string; options: string; correct: number; explanation: string; q_revision: string}>();
  const works = new Map<string, CatalogWork>();
  for (const row of rows.results) {
    if (!works.has(row.id)) works.set(row.id, { id: row.id, courseId: row.course_id, courseTitle: workCourses[row.course_id], level: row.level, title: row.title, lessonTitle: row.lesson_title || "Trabalho", version: row.version, revision: row.revision, questions: [] });
    if (row.q_id) works.get(row.id)!.questions.push(mapQuestion({ id: row.q_id, course_id: row.q_course_id, level: row.q_level, prompt: row.prompt, options: row.options, correct: row.correct, explanation: row.explanation, revision: row.q_revision }));
  }
  return [...works.values()];
}
export async function catalogDefinition(id: string) {
  const work = (await listCatalogWorks()).find(w => w.id === id);
  if (!work) throw new WorkError("Trabalho não encontrado.", 404);
  return work;
}
export function releasedDefinition(id: string, snapshot: string | null): CatalogWork {
  if (snapshot) return JSON.parse(snapshot) as CatalogWork;
  // Old W-A1 releases keep the original questions even if its library entry is edited.
  const legacy = workDefinitions.find(w => w.id === id);
  if (!legacy) throw new WorkError("Conteúdo desta liberação não está disponível.", 409);
  return legacy;
}
export async function saveBankQuestion(data: Record<string, unknown>, editing: boolean) {
  const q = questionInput(data);
  const db = database();
  const now = new Date().toISOString();
  const revision = crypto.randomUUID();
  const id = editing ? String(data.id || "") : crypto.randomUUID();
  if (editing) {
    const old = await db.prepare("SELECT course_id FROM question_bank WHERE id=?").bind(id).first<{course_id: string}>();
    if (!old) throw new WorkError("Questão não encontrada.", 404);
    if (old.course_id !== q.courseId) throw new WorkError("O curso de uma questão cadastrada não pode ser alterado. Cadastre uma nova questão para outro curso.");
    const result = await db.prepare(`UPDATE question_bank SET level=?,prompt=?,options=?,correct=?,explanation=?,revision=?,updated_at=?
      WHERE id=? AND revision=?`).bind(q.level, q.prompt, JSON.stringify(q.options), q.correct, q.explanation, revision, now, id, String(data.revision || "")).run();
    if (!result.meta.changes) throw new WorkError("Esta questão foi alterada em outra aba. Atualize a lista antes de editar novamente.", 409);
  } else {
    await db.prepare(`INSERT INTO question_bank (id,course_id,level,prompt,options,correct,explanation,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, q.courseId, q.level, q.prompt, JSON.stringify(q.options), q.correct, q.explanation, revision, now, now).run();
  }
  return { id, ...q, revision };
}
export async function saveCatalogWork(data: Record<string, unknown>, editing: boolean) {
  const w = workInput(data);
  const db = database();
  const questions = await listBankQuestions();
  if (!w.questionIds.every(id => questions.some(q => q.id === id && q.courseId === w.courseId))) throw new WorkError("Selecione apenas questões existentes do mesmo curso do trabalho.");
  const now = new Date().toISOString();
  const revision = crypto.randomUUID();
  const old = await db.prepare("SELECT course_id FROM managed_works WHERE id=?").bind(w.id).first<{course_id: string}>();
  if (editing && !old) throw new WorkError("Trabalho não encontrado.", 404);
  if (!editing && old) throw new WorkError("Já existe um trabalho com este código.", 409);
  if (editing && old?.course_id !== w.courseId) throw new WorkError("O curso de um trabalho cadastrado não pode ser alterado. Cadastre um novo trabalho para outro curso.");
  const first = editing
    ? db.prepare(`UPDATE managed_works SET title=?,level=?,lesson_title=?,version=version+1,revision=?,updated_at=? WHERE id=? AND revision=?`)
      .bind(w.title, w.level, w.lessonTitle, revision, now, w.id, String(data.revision || ""))
    : db.prepare(`INSERT INTO managed_works (id,course_id,level,title,lesson_title,version,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,1,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(w.id, w.courseId, w.level, w.title, w.lessonTitle, revision, now, now);
  const results = await db.batch([
    first,
    db.prepare("DELETE FROM managed_work_questions WHERE work_id=? AND EXISTS (SELECT 1 FROM managed_works WHERE id=? AND revision=?)").bind(w.id, w.id, revision),
    ...w.questionIds.map((id, index) => db.prepare("INSERT INTO managed_work_questions (work_id,question_id,position) SELECT id,?,? FROM managed_works WHERE id=? AND revision=?").bind(id, index, w.id, revision)),
  ]);
  if (!results[0].meta.changes) throw new WorkError("O trabalho foi cadastrado ou alterado em outra aba. Atualize a lista antes de editar novamente.", 409);
  return catalogDefinition(w.id);
}
export const catalogOptions = { courses: workCourses, levels: workLevels };
