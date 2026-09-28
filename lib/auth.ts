import { headers } from "next/headers";

const SESSION_COOKIE_NAME = "trials_session";
const SECRET_KEY = "trials_session_secret_cloudflare_workers_2026";
const PASSWORD_SALT = "trials_salt_key_2026";

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: "professor" | "aluno";
  courseId: string | null;
  courseTitle?: string | null;
};

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ":" + PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TR-${code}`;
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  const payload = JSON.stringify({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    courseId: user.courseId || null,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  });

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const b64Payload = btoa(unescape(encodeURIComponent(payload)));
  return `${b64Payload}.${sigHex}`;
}

export async function verifySessionToken(
  token: string
): Promise<AuthUser | null> {
  try {
    const [b64Payload, sigHex] = token.split(".");
    if (!b64Payload || !sigHex) return null;

    const payload = decodeURIComponent(escape(atob(b64Payload)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const matchBytes = sigHex.match(/.{1,2}/g);
    if (!matchBytes) return null;
    const sigBytes = new Uint8Array(matchBytes.map((byte) => parseInt(byte, 16)));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(payload)
    );

    if (!isValid) return null;

    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return null;

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      role: data.role,
      courseId: data.courseId,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(
  request?: Request
): Promise<AuthUser | null> {
  let cookieHeader = "";
  if (request) {
    cookieHeader = request.headers.get("cookie") || "";
  } else {
    try {
      const headersList = await headers();
      cookieHeader = headersList.get("cookie") || "";
    } catch {
      cookieHeader = "";
    }
  }

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );

  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  return verifySessionToken(token);
}

export function createSessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
