import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request and gates
 * protected routes. IMPORTANT: any redirect we return must carry over the
 * cookies Supabase refreshed on `response`, otherwise the rotated session
 * cookie is dropped and the app ping-pongs between "/" and "/login"
 * (ERR_TOO_MANY_REDIRECTS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/debug");

  // Redirect unauthenticated users to /login, carrying the refreshed cookies.
  // (We deliberately do NOT redirect authenticated users away from /login here
  //  — that back-and-forth, combined with any edge case, is a loop risk. The
  //  login page sends them onward after a successful sign-in instead.)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
