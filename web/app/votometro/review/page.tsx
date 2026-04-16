import { cookies } from "next/headers";

import { VotometroReviewPage } from "@/components/votometro/review-page";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import {
  VOTOMETRO_REVIEW_COOKIE,
  isReviewConfigured,
  isValidReviewCookie,
} from "@/lib/votometro-admin";
import type {
  IdentityConflictRecord,
  PromiseReviewRecord,
  VotometroDataIssue,
} from "@/lib/votometro-types";
import { getReviewDashboard } from "@/lib/votometro-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);

  return buildPageMetadata({
    lang,
    path: `/votometro/review?lang=${lang}`,
    title: "VotóMeter Review — VeedurIA",
    description: "Backoffice mínimo para revisar promesas, matches y colisiones de identidad de VotóMeter.",
    imagePath: "/votometro/opengraph-image",
  });
}

export default async function VotometroReviewRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);
  const configured = isReviewConfigured();
  const cookieStore = await cookies();
  const authed = isValidReviewCookie(cookieStore.get(VOTOMETRO_REVIEW_COOKIE)?.value);

  let promiseQueue: PromiseReviewRecord[] = [];
  let identityQueue: IdentityConflictRecord[] = [];
  let runs: Record<string, unknown>[] = [];
  let issue: VotometroDataIssue | null = null;

  if (configured && authed) {
    const dashboard = await getReviewDashboard();
    promiseQueue = dashboard.promiseQueue;
    identityQueue = dashboard.identityQueue;
    runs = dashboard.runs;
    issue = dashboard.issue;
  }

  return (
    <VotometroReviewPage
      lang={lang}
      isConfigured={configured}
      isAuthenticated={authed}
      promiseQueue={promiseQueue}
      identityQueue={identityQueue}
      runs={runs}
      issue={issue}
    />
  );
}
