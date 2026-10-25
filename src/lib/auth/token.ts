/**
 * Stateless signed session tokens: `<userId>.<expiresMs>.<hmac>`.
 * Uses Web Crypto so the same code runs in the proxy and in server components.
 */

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(userId: string, secret: string, ttlMs = 1000 * 60 * 60 * 12, now = Date.now()) {
  const payload = `${userId}.${now + ttlMs}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!/^[a-z0-9_-]+$/i.test(userId) || !/^\d+$/.test(exp) || Number(exp) < now) return null;
  const expected = await hmac(secret, `${userId}.${exp}`);
  return timingSafeEqual(sig, expected) ? userId : null;
}

export const SESSION_COOKIE = "lathe_session";

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production" && process.env.LATHE_REQUIRE_SECRET === "1") {
    throw new Error("SESSION_SECRET must be set (≥16 chars) in production");
  }
  return "lathe-demo-secret-not-for-production";
}
