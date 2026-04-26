import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/metadata";
import { getVotometroDirectory } from "@/lib/votometro-server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().replace(/\/$/, "");
  const now = new Date();

  // Static product surfaces — landing + every public module in both languages.
  const staticPaths: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/",                priority: 1.0, changeFrequency: "daily"  },
    { path: "/contrato-limpio", priority: 0.9, changeFrequency: "daily"  },
    { path: "/votometro",       priority: 0.9, changeFrequency: "daily"  },
    { path: "/sigue-el-dinero", priority: 0.8, changeFrequency: "daily"  },
    { path: "/promesometro",    priority: 0.7, changeFrequency: "weekly" },
    { path: "/etica-y-privacidad", priority: 0.4, changeFrequency: "monthly" },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.flatMap(({ path, priority, changeFrequency }) => {
    return ["es", "en"].map((lang) => ({
      url: `${base}${path}?lang=${lang}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          es: `${base}${path}?lang=es`,
          en: `${base}${path}?lang=en`,
        },
      },
    }));
  });

  // Dynamically include every legislator profile so each one gets indexed
  // independently.  Failure here must never break the sitemap — fallback to
  // an empty list so static URLs still ship.
  try {
    const directory = await getVotometroDirectory(new URLSearchParams("page_size=500"));
    for (const item of directory.items) {
      if (!item.slug) continue;
      entries.push({
        url: `${base}/votometro/legislador/${item.slug}?lang=es`,
        lastModified: item.updatedAt ? new Date(item.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: {
          languages: {
            es: `${base}/votometro/legislador/${item.slug}?lang=es`,
            en: `${base}/votometro/legislador/${item.slug}?lang=en`,
          },
        },
      });
    }
  } catch {
    // ignore — keep the static portion of the sitemap working
  }

  return entries;
}
