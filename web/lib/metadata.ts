import type { Metadata } from "next";

import type { Lang } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://veeduria.vercel.app";

export function buildPageMetadata({
  lang,
  path,
  title,
  description,
  imagePath,
}: {
  lang: Lang;
  path: string;
  title: string;
  description: string;
  imagePath: string;
}): Metadata {
  const locale = lang === "es" ? "es_CO" : "en_US";
  const url = `${SITE_URL}${path}`;
  const image = `${SITE_URL}${imagePath}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale,
      url,
      title,
      description,
      siteName: "VeedurIA",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function getSiteUrl() {
  return SITE_URL;
}
