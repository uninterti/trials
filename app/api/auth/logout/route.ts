import { clearSessionCookieHeader } from "@/lib/auth";

export async function POST() {
  const cookieHeader = clearSessionCookieHeader();
  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": cookieHeader,
        "Cache-Control": "no-store",
      },
    }
  );
}
