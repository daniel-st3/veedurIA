import { NextRequest, NextResponse } from "next/server";

import { getPartySummaries } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber");
  const payload = await getPartySummaries(
    chamber === "senado" || chamber === "camara" ? chamber : undefined,
  );
  return NextResponse.json({
    meta: {
      total: payload.length,
      generatedAt: new Date().toISOString(),
    },
    items: payload,
  });
}
