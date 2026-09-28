import { database, seedInitialContent } from "@/db/content";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await seedInitialContent();
    const session = await getSessionUser(request);
    if (!session) {
      return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const db = database();
    const user = await db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.role, u.course_id, c.title as course_title
         FROM users u
         LEFT JOIN courses c ON u.course_id = c.id
         WHERE u.id = ?
         LIMIT 1`
      )
      .bind(session.id)
      .first<{
        id: string;
        name: string;
        phone: string;
        role: "professor" | "aluno";
        course_id: string | null;
        course_title: string | null;
      }>();

    if (!user) {
      return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    }

    return Response.json(
      {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          courseId: user.course_id,
          courseTitle: user.course_title,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Auth check failed", error);
    return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
