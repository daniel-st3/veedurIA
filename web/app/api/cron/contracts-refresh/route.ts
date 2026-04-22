import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_API_BASE = "https://api.github.com";
const WORKFLOW_FILE = "secop_ingestion.yml";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized();
  }

  try {
    const repo = requiredEnv("GITHUB_ACTIONS_REPOSITORY");
    const ref =
      process.env.GITHUB_ACTIONS_REF?.trim() ||
      process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
      "main";
    const token = requiredEnv("GITHUB_ACTIONS_DISPATCH_TOKEN");

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "VeedurIA-Cron-Dispatch",
        },
        body: JSON.stringify({
          ref,
          inputs: {
            mode: "incremental",
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: "GitHub workflow dispatch failed",
          status: response.status,
          details,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      workflow: WORKFLOW_FILE,
      repository: repo,
      ref,
      mode: "incremental",
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected cron error",
      },
      { status: 500 },
    );
  }
}
