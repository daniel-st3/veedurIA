"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { LanguageSwitch } from "@/components/language-switch";
import type { Lang } from "@/lib/types";

type Props = {
  lang: Lang;
  links: { href: string; label: string }[];
  ctaHref?: string;
  ctaLabel?: string;
};

export function SiteNav({ lang, links }: Props) {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      <Link href={`/?lang=${lang}`} className="brand" aria-label="VeedurIA">
        <span className="brand-mark">
          <span className="brand-word">Veedur</span>
          <span className="brand-ia" aria-hidden>
            <span className="brand-flag brand-flag--yellow">I</span>
            <span className="brand-flag brand-flag--blue">A</span>
            <span className="brand-flag brand-flag--red">.</span>
          </span>
        </span>
        <span className="brand-caption">
          {lang === "es" ? "lectura pública del poder" : "public audit layer"}
        </span>
      </Link>

      <div className="nav-links">
        {links.map((link) => {
          const targetPath = link.href.split("?")[0] || "/";
          const isActive = pathname === targetPath;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link-pill"
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="nav-actions">
        <Suspense fallback={<span style={{ width: 52 }} />}>
          <LanguageSwitch lang={lang} />
        </Suspense>
      </div>
    </nav>
  );
}
