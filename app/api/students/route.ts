import { database, seedInitialContent } from "@/db/content";
import { generateRandomPassword, getSessionUser, hashPassword } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await seedInitialContent();
    const session = await getSessionUser(request);

    if (!session || session.role !== "professor") {
      return Response.json(
        { error: "Acesso restrito a professores." },
        { status: 403 }
      );
    }

    const db = database();
    const result = await db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.role, u.initial_password, u.course_id, u.created_at, c.title as course_title
         FROM users u
         LEFT JOIN courses c ON u.course_id = c.id
         WHERE u.role = 'aluno'
         ORDER BY u.created_at DESC`
      )
      .all<{
        id: string;
        name: string;
        phone: string;
        role: string;
        initial_password: string | null;
        course_id: string | null;
        created_at: string;
        course_title: string | null;
      }>();

    return Response.json(
      { students: result.results || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("List students failed", error);
    return Response.json(
      { error: "Não foi possível carregar a lista de alunos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await seedInitialContent();
    const session = await getSessionUser(request);

    if (!session || session.role !== "professor") {
      return Response.json(
        { error: "Acesso restrito a professores." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      phone?: string;
      courseId?: string;
    };

    const name = (body.name || "").trim();
    const rawPhone = (body.phone || "").trim();
    const courseId = (body.courseId || "").trim();

    if (!name || !rawPhone || !courseId) {
      return Response.json(
        { error: "Preencha todos os campos: Nome, Telefone e Curso." },
        { status: 400 }
      );
    }

    const db = database();

    // Check if course exists
    const course = await db
      .prepare("SELECT id, title FROM courses WHERE id = ?")
      .bind(courseId)
      .first<{ id: string; title: string }>();

    if (!course) {
      return Response.json(
        { error: "O curso selecionado é inválido." },
        { status: 400 }
      );
    }

    // Check if student with same phone already exists
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const existingStudent = await db
      .prepare(
        `SELECT id FROM users 
         WHERE phone = ? OR (length(?) > 0 AND replace(replace(replace(replace(phone, '(', ''), ')', ''), '-', ''), ' ', '') = ?)
         LIMIT 1`
      )
      .bind(rawPhone, cleanPhone, cleanPhone)
      .first();

    if (existingStudent) {
      return Response.json(
        { error: "Já existe um usuário cadastrado com este telefone." },
        { status: 409 }
      );
    }

    // Generate automatic password
    const autoPassword = generateRandomPassword();
    const passwordHash = await hashPassword(autoPassword);
    const studentId = `student-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    const createdAt = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO users (id, name, phone, role, password_hash, initial_password, course_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        studentId,
        name,
        rawPhone,
        "aluno",
        passwordHash,
        autoPassword,
        courseId,
        createdAt
      )
      .run();

    return Response.json({
      student: {
        id: studentId,
        name,
        phone: rawPhone,
        role: "aluno",
        courseId,
        courseTitle: course.title,
        initialPassword: autoPassword,
        createdAt,
      },
    });
  } catch (error) {
    console.error("Create student failed", error);
    return Response.json(
      { error: "Erro ao cadastrar aluno. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await seedInitialContent();
    const session = await getSessionUser(request);

    if (!session || session.role !== "professor") {
      return Response.json(
        { error: "Acesso restrito a professores." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "ID do aluno é obrigatório." },
        { status: 400 }
      );
    }

    const db = database();
    await db.prepare("DELETE FROM users WHERE id = ? AND role = 'aluno'").bind(id).run();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Delete student failed", error);
    return Response.json(
      { error: "Erro ao remover aluno." },
      { status: 500 }
    );
  }
}
