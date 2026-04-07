import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/jwt";

const protectedPrefixes = [
  "/dashboard",
  "/products",
  "/categories",
  "/stock-logs",
  "/users",
  "/settings",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  let validSession = false;
  if (token) {
    try {
      await verifyAuthToken(token);
      validSession = true;
    } catch {
      validSession = false;
    }
  }

  if (pathname === "/login" && validSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedPath(pathname) && !validSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/products/:path*",
    "/categories/:path*",
    "/stock-logs/:path*",
    "/users/:path*",
    "/settings/:path*",
  ],
};
