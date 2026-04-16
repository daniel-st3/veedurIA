import { NextRequest, NextResponse } from "next/server";

import { getPartySummariesPayload } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber");
  const payload = await getPartySummariesPayload(
    chamber === "senado" || chamber === "camara" ? chamber : undefined,
  );
  return NextResponse.json(payload, {
    status: payload.issue?.httpStatus ?? 200,
  });
}
