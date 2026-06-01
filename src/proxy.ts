import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, GUEST_COOKIE_NAME } from "@/lib/cookies";
import { guestSlugExists } from "@/lib/db";
import { isValidSlug } from "@/lib/slug";

const RESERVED_TOP_LEVEL_PATHS = new Set(["admin", "savethedate"]);

function isGuestSlugPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && !RESERVED_TOP_LEVEL_PATHS.has(segments[0]) && isValidSlug(segments[0]);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const guestSlug = request.cookies.get(GUEST_COOKIE_NAME)?.value;

  if (
    request.method === "GET" &&
    pathname === "/" &&
    isValidSlug(guestSlug) &&
    (await guestSlugExists(guestSlug))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${guestSlug}`;
    return NextResponse.redirect(url);
  }

  if (request.method === "GET" && isGuestSlugPath(pathname)) {
    const slug = pathname.slice(1);
    if (await guestSlugExists(slug)) {
      const response = NextResponse.next();
      response.cookies.set(GUEST_COOKIE_NAME, slug, cookieOptions());
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
