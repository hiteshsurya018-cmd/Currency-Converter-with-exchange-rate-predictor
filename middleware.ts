import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check if the user is authenticated by looking for a session cookie
  // This is a simplified example - in a real app, you would verify the session
  const authCookie = request.cookies.get("auth_session")

  // Define protected routes that require authentication
  const protectedRoutes = [
    // Add any premium features that require authentication
    // For now, we'll keep the expense tracker accessible to all users
    // "/expenses",
  ]

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // If it's a protected route and the user is not authenticated, redirect to login
  if (isProtectedRoute && !authCookie) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Add routes that should be checked by the middleware
    // For now, we'll keep all routes accessible
    // "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
