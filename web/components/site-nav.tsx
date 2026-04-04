import Link from "next/link";
import { Suspense } from "react";

import { LanguageSwitch } from "@/components/language-switch";
import type { Lang } from "@/lib/types";

type Props = {
  lang: Lang;
  links: { href: string; label: string }[];
  ctaHref?: string;
  ctaLabel?: string;
};

export function SiteNav({ lang, links }: Props) {
  return (
    <nav className="site-nav">
      <Link href={`/?lang=${lang}`} className="brand" aria-label="VeedurIA">
        <span className="brand-word">Veedur</span>
        <span className="brand-ia" aria-hidden>
          <span className="brand-flag brand-flag--yellow">I</span>
          <span className="brand-flag brand-flag--blue">A</span>
          <span className="brand-flag brand-flag--red">.</span>
        </span>
      </Link>

      <div className="nav-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="nav-link-pill">
            {link.label}
          </Link>
        ))}
      </div>

      <div className="nav-actions">
        <Suspense fallback={<span style={{ width: 52 }} />}>
          <LanguageSwitch lang={lang} />
        </Suspense>
      </div>
    </nav>
  );
}
