import { NextRequest, NextResponse } from "next/server";

import { getVotometroVotes } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const slug = search.get("slug") ?? undefined;
  const topic = search.get("topic") ?? undefined;
  const page = Number(search.get("page") ?? 1);
  const pageSize = Number(search.get("page_size") ?? 20);

  const payload = await getVotometroVotes({
    slug,
    topic,
    page: Number.isFinite(page) ? Math.max(1, page) : 1,
    pageSize: Number.isFinite(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 20,
  });

  return NextResponse.json(payload, {
    status: payload.issue?.httpStatus ?? 200,
  });
}
