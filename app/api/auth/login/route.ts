import { database, seedInitialContent } from "@/db/content";
import {
  createSessionCookieHeader,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await seedInitialContent();
    const body = (await request.json().catch(() => ({}))) as {
      login?: string;
      password?: string;
    };

    const login = (body.login || "").trim();
    const password = (body.password || "").trim();

    if (!login || !password) {
      return Response.json(
        { error: "Informe o usuário/telefone e a senha." },
        { status: 400 }
      );
    }

    const db = database();

    // Query user by exact phone, or by clean phone digits, or username "professor"/"admin"
    const cleanLogin = login.replace(/\D/g, "");

    const user = await db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.role, u.password_hash, u.initial_password, u.course_id, c.title as course_title
         FROM users u
         LEFT JOIN courses c ON u.course_id = c.id
         WHERE u.phone = ? OR (length(?) > 0 AND replace(replace(replace(replace(u.phone, '(', ''), ')', ''), '-', ''), ' ', '') = ?)
         OR (u.role = 'professor' AND (? = 'professor' OR ? = 'admin'))
         LIMIT 1`
      )
      .bind(login, cleanLogin, cleanLogin, login.toLowerCase(), login.toLowerCase())
      .first<{
        id: string;
        name: string;
        phone: string;
        role: "professor" | "aluno";
        password_hash: string;
        initial_password: string | null;
        course_id: string | null;
        course_title: string | null;
      }>();

    if (!user) {
      return Response.json(
        { error: "Usuário ou telefone não encontrado." },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return Response.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const authUser = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      courseId: user.course_id,
      courseTitle: user.course_title,
    };

    const token = await createSessionToken(authUser);
    const cookieHeader = createSessionCookieHeader(token);

    return Response.json(
      { user: authUser },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookieHeader,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Login failed", error);
    return Response.json(
      { error: "Erro ao processar o login. Tente novamente." },
      { status: 500 }
    );
  }
}
