import { createHash, timingSafeEqual } from "node:crypto";

export const VOTOMETRO_REVIEW_COOKIE = "votometro_review";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function getReviewPassword() {
  return process.env.VOTOMETRO_REVIEW_PASSWORD ?? "";
}

export function isReviewConfigured() {
  return Boolean(getReviewPassword().trim());
}

export function buildReviewCookieValue() {
  const password = getReviewPassword().trim();
  return password ? sha256(password) : "";
}

export function isValidReviewCookie(cookieValue?: string | null) {
  const expected = buildReviewCookieValue();
  const actual = (cookieValue ?? "").trim();
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
