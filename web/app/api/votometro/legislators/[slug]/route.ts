import { NextResponse } from "next/server";

import { getVotometroProfile } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await getVotometroProfile(slug);
  if (!payload) {
    return NextResponse.json({ error: "Legislator not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
