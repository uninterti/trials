import { database } from "@/db/content";
import { publicWork, workDefinitions } from "@/lib/work-bank";
import { actor, body, definition, fail, json, stringId, student, studentAssignments, WorkError } from "@/lib/works";

export async function GET(request: Request) {
  try {
    const user = await actor(request);
    const studentId = user.role === "professor" ? new URL(request.url).searchParams.get("studentId") : user.id;
    if (user.role === "professor" && !studentId) return json({ works: workDefinitions.map(publicWork), assignments: [] });
    if (!studentId) throw new WorkError("Selecione um aluno.");
    await student(studentId);
    return json({ works: user.role === "professor" ? workDefinitions.map(publicWork) : [], assignments: await studentAssignments(studentId) });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const user = await actor(request, "professor");
    const data = await body(request);
    const target = await student(stringId(data.studentId));
    const work = definition(stringId(data.workId));
    if (target.course_id !== work.courseId) throw new WorkError("O trabalho deve pertencer ao curso do aluno.");
    await database().prepare(`INSERT INTO work_assignments (id,work_id,student_id,released_by,released_at)
      VALUES (?,?,?,?,?) ON CONFLICT(work_id,student_id) DO NOTHING`)
      .bind(crypto.randomUUID(), work.id, target.id, user.id, new Date().toISOString()).run();
    return json({ assignments: await studentAssignments(target.id), message: "Trabalho liberado para o aluno." });
  } catch (error) { return fail(error); }
}
