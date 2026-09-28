import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

// 전시장은 GS25 사이트에서 이미 인증한 경영주가 새 창으로 들어오는 경로다.
// DeskRPG 계정과는 별개이므로 로그인으로 돌려보내면 안 된다.
const PUBLIC_PATHS = ["/", "/auth", "/api/auth", "/api/health", "/exhibition"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/assets")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL("/auth", req.url));
    response.cookies.delete("token");
    return response;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-nickname", encodeURIComponent(payload.nickname));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
