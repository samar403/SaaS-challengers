import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth/token";

/** Gate the app: unauthenticated requests to /app and /api go to the persona picker. */
export async function proxy(request: NextRequest) {
  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (userId) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};
