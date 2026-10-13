import { database } from "@/db/content";
import { actor, fail, json, stringId, student, studentAssignments } from "@/lib/works";

export async function GET(request: Request) {
  try {
    await actor(request, "professor");
    const target = await student(stringId(new URL(request.url).searchParams.get("studentId")));
    const assignments = await studentAssignments(target.id);
    const history = await database().prepare(`SELECT t.id,t.assignment_id,t.score,t.total,t.started_at,t.submitted_at
      FROM work_attempts t JOIN work_assignments a ON a.id=t.assignment_id
      WHERE a.student_id=? AND t.submitted_at IS NOT NULL ORDER BY t.submitted_at DESC,t.rowid DESC`).bind(target.id).all();
    return json({ student: target, assignments, history: history.results });
  } catch (error) { return fail(error); }
}
