import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isAuthRoute(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/signup");
}

function isProtectedRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/holdings") ||
    pathname.startsWith("/market-research") ||
    pathname.startsWith("/cards") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin")
  );
}

function shouldClearBrokenSession(error: { message?: string; code?: string } | null) {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  return (
    code === "refresh_token_already_used" ||
    code === "refresh_token_not_found" ||
    code === "over_request_rate_limit" ||
    message.includes("refresh token") ||
    message.includes("rate limit")
  );
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("-auth-token")
    ) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/") {
    return NextResponse.next({ request });
  }

  if (
    pathname === "/collection" ||
    pathname.startsWith("/collection/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/holdings";
    return NextResponse.redirect(url);
  }

  // Do not refresh a dead session on the login form — that loop is what
  // hits Supabase Auth rate limits after a refresh-token failure.
  if (isAuthRoute(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && shouldClearBrokenSession(error)) {
    clearAuthCookies(request, supabaseResponse);
    if (isProtectedRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirect = NextResponse.redirect(url);
      clearAuthCookies(request, redirect);
      return redirect;
    }
    return supabaseResponse;
  }

  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
