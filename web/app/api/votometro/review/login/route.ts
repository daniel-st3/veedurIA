import { NextResponse } from "next/server";

import {
  VOTOMETRO_REVIEW_COOKIE,
  buildReviewCookieValue,
  getReviewPassword,
} from "@/lib/votometro-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const lang = String(formData.get("lang") ?? "es");

  if (!getReviewPassword().trim() || password !== getReviewPassword().trim()) {
    return NextResponse.redirect(new URL(`/votometro/review?lang=${lang}`, request.url), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL(`/votometro/review?lang=${lang}`, request.url), {
    status: 303,
  });

  response.cookies.set({
    name: VOTOMETRO_REVIEW_COOKIE,
    value: buildReviewCookieValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
