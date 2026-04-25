import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.includes("](http:") || pathname.includes("localhost:3001")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?lang=es";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && !request.nextUrl.searchParams.has("lang")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("lang", "es");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
