import { NextResponse } from "next/server";

import { getVotometroProfileResult } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await getVotometroProfileResult(slug);
  if (payload.issue) {
    return NextResponse.json(
      {
        error: payload.issue.message,
        issue: payload.issue,
      },
      { status: payload.issue.httpStatus },
    );
  }
  if (!payload.profile) {
    return NextResponse.json({ error: "Legislator not found" }, { status: 404 });
  }
  return NextResponse.json(payload.profile);
}
