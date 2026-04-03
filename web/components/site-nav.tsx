import Link from "next/link";

import { LanguageSwitch } from "@/components/language-switch";
import type { Lang } from "@/lib/types";

type Props = {
  lang: Lang;
  links: { href: string; label: string }[];
  ctaHref?: string;
  ctaLabel?: string;
};

export function SiteNav({ lang, links, ctaHref, ctaLabel }: Props) {
  return (
    <nav className="site-nav">
      <div className="site-nav__brand">
        <Link href={`/?lang=${lang}`} className="brand">
          Veedur<span className="y">I</span>
          <span className="b">A</span>
          <span className="r">.</span>
        </Link>
        <span className="site-nav__meta">Plataforma cívica de lectura pública</span>
      </div>
      <div className="nav-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav-actions">
        <LanguageSwitch lang={lang} />
        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className="nav-cta">
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
