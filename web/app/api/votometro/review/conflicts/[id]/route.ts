import { NextResponse } from "next/server";

import {
  VOTOMETRO_REVIEW_COOKIE,
  isValidReviewCookie,
} from "@/lib/votometro-admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const formData = await request.formData();
  const { id } = await params;
  const lang = String(formData.get("lang") ?? "es");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${VOTOMETRO_REVIEW_COOKIE}=`))
    ?.split("=")[1];

  if (!isValidReviewCookie(cookieValue)) {
    return NextResponse.redirect(new URL(`/votometro/review?lang=${lang}`, request.url), {
      status: 303,
    });
  }

  const status = String(formData.get("status") ?? "pending");
  const resolvedNote = String(formData.get("resolved_note") ?? "").trim();
  const supabase = createServiceSupabase();

  await supabase
    .from("identity_conflicts")
    .update({
      status,
      resolved_note: resolvedNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.redirect(new URL(`/votometro/review?lang=${lang}`, request.url), {
    status: 303,
  });
}
