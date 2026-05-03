import Link from "next/link";
import { ArrowRight, Github, ShieldCheck, Database, Waypoints, FileText } from "lucide-react";

import type { Lang } from "@/lib/types";

export function SiteFooter({ lang }: { lang: Lang }) {
  const links = [
    {
      href: `/contrato-limpio?lang=${lang}`,
      label: "ContratoLimpio",
      detail: lang === "es" ? "Contratos y anomalías" : "Contracts and anomalies",
      icon: Database,
    },
    {
      href: `/votometro?lang=${lang}`,
      label: "Votómetro",
      detail: lang === "es" ? "Votos nominales" : "Roll-call votes",
      icon: ShieldCheck,
    },
    {
      href: `/sigue-el-dinero?lang=${lang}`,
      label: "SigueElDinero",
      detail: lang === "es" ? "Red de relaciones públicas" : "Public relationship network",
      icon: Waypoints,
    },
    {
      href: `/metodologia?lang=${lang}`,
      label: lang === "es" ? "Metodología" : "Methodology",
      detail: lang === "es" ? "Modelo y límites" : "Model and limits",
      icon: FileText,
    },
    {
      href: "https://github.com/daniel-st3/veedurIA",
      label: "GitHub",
      detail: lang === "es" ? "Código y trazabilidad" : "Code and traceability",
      icon: Github,
      external: true,
    },
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__kicker">
            {lang === "es" ? "VeedurIA · fuente pública" : "VeedurIA · public source"}
          </span>
          <strong>{lang === "es" ? "Auditoría pública con contexto." : "Public oversight with context."}</strong>
          <p>
            {lang === "es"
              ? "Radar ciudadano para revisar contratación pública, votaciones legislativas y redes de poder con fuentes verificables."
              : "Citizen radar to review public procurement, legislative voting records, and power networks with verifiable sources."}
          </p>
          <div className="site-footer__chips" aria-label={lang === "es" ? "Fuentes" : "Sources"}>
            <span>SECOP II</span>
            <span>datos.gov.co</span>
            <span>{lang === "es" ? "Senado abierto" : "Open Senate"}</span>
          </div>
        </div>

        <nav className="site-footer__links" aria-label={lang === "es" ? "Navegación secundaria" : "Secondary navigation"}>
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                className="site-footer__link-card"
              >
                <span className="site-footer__link-icon"><Icon size={16} aria-hidden={true} /></span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight size={15} aria-hidden={true} />
              </Link>
            );
          })}
        </nav>

        <div className="site-footer__bottom">
          <span>{lang === "es" ? "Desarrollado por Daniel Steven Rodríguez Sandoval" : "Developed by Daniel Steven Rodríguez Sandoval"}</span>
          <Link href={`/etica-y-privacidad?lang=${lang}`}>
            {lang === "es" ? "Legal, privacidad y seguridad" : "Legal, privacy, and security"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
