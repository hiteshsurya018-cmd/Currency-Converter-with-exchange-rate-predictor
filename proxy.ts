import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  // Check if the user is authenticated by looking for a session cookie.
  const authCookie = request.cookies.get("auth_session")

  const protectedRoutes: string[] = [
    // Add premium routes here when they need authentication.
    // "/expenses",
  ]

  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  if (isProtectedRoute && !authCookie) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Add routes that should be checked by the proxy.
    // "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
