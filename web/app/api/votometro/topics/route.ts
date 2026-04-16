import { NextResponse } from "next/server";

import { getTopicOptions } from "@/lib/votometro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    meta: {
      total: getTopicOptions().length,
      generatedAt: new Date().toISOString(),
    },
    items: getTopicOptions(),
  });
}
