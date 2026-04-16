import { NextResponse } from "next/server";

import { VOTOMETRO_REVIEW_COOKIE } from "@/lib/votometro-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const lang = String(formData.get("lang") ?? "es");
  const response = NextResponse.redirect(new URL(`/votometro/review?lang=${lang}`, request.url), {
    status: 303,
  });
  response.cookies.set({
    name: VOTOMETRO_REVIEW_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
