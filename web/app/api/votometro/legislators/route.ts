import { NextRequest, NextResponse } from "next/server";

import { getVotometroDirectory } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getVotometroDirectory(request.nextUrl.searchParams);
  return NextResponse.json(payload);
}
