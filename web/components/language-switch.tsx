"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Lang } from "@/lib/types";

export function LanguageSwitch({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (target: Lang) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", target);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="language-switch" aria-label="language switch">
      <Link href={hrefFor("es")} className={lang === "es" ? "active" : ""}>
        ES
      </Link>
      <Link href={hrefFor("en")} className={lang === "en" ? "active" : ""}>
        EN
      </Link>
    </div>
  );
}
