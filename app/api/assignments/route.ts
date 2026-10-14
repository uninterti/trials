import { seedWorkCatalog, listCatalogWorks, catalogDefinition } from "@/lib/work-catalog";
import { database } from "@/db/content";
import { publicWork } from "@/lib/work-bank";
import { actor, body, fail, json, stringId, student, studentAssignments, WorkError } from "@/lib/works";

export async function GET(request: Request) {
  try {
    const user = await actor(request);
    let works: ReturnType<typeof publicWork>[] = [];
    if (user.role === "professor") {
      await seedWorkCatalog();
      works = (await listCatalogWorks()).filter(w => w.questions.length === 10).map(publicWork);
    }
    const studentId = user.role === "professor" ? new URL(request.url).searchParams.get("studentId") : user.id;
    if (user.role === "professor" && !studentId) return json({ works, assignments: [] });
    if (!studentId) throw new WorkError("Selecione um aluno.");
    await student(studentId);
    return json({ works, assignments: await studentAssignments(studentId) });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const user = await actor(request, "professor");
    const data = await body(request);
    const target = await student(stringId(data.studentId));
    await seedWorkCatalog();
    const work = await catalogDefinition(stringId(data.workId));
    if (work.questions.length !== 10) throw new WorkError("Complete o trabalho com 10 questões antes de liberá-lo.");
    if (target.course_id !== work.courseId) throw new WorkError("O trabalho deve pertencer ao curso do aluno.");
    await database().prepare(`INSERT INTO work_assignments (id,work_id,student_id,released_by,released_at,definition_snapshot)
      VALUES (?,?,?,?,?,?) ON CONFLICT(work_id,student_id) DO NOTHING`)
      .bind(crypto.randomUUID(), work.id, target.id, user.id, new Date().toISOString(), JSON.stringify(work)).run();
    return json({ assignments: await studentAssignments(target.id), message: "Trabalho liberado para o aluno." });
  } catch (error) { return fail(error); }
}
