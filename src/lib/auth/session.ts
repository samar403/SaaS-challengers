import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { findUser, type DemoUser } from "./users";
import { SESSION_COOKIE, sessionSecret, verifySession } from "./token";

/** Data-access-layer entry point: every server read of "who is this" goes through here. */
export async function getCurrentUser(): Promise<DemoUser> {
  await connection(); // session expiry is checked against the clock
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = findUser((await verifySession(token, sessionSecret())) ?? undefined);
  if (!user) redirect("/login");
  return user;
}

export async function getOptionalUser(): Promise<DemoUser | null> {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return findUser((await verifySession(token, sessionSecret())) ?? undefined) ?? null;
}
