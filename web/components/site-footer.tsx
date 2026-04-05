import Link from "next/link";

import type { Lang } from "@/lib/types";

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <strong>VeedurIA</strong>
          <p>
            {lang === "es"
              ? "Radar ciudadano para revisar contratación pública, votaciones legislativas y redes de poder con fuentes verificables."
              : "Citizen radar to review public procurement, legislative voting records, and power networks with verifiable sources."}
          </p>
        </div>

        <div className="site-footer__meta">
          <span>Desarrollado por Daniel Steven Rodríguez Sandoval</span>
          <Link href={`/contrato-limpio?lang=${lang}`}>ContratoLimpio</Link>
          <Link href={`/votometro?lang=${lang}`}>VotóMeter</Link>
          <Link href={`/sigue-el-dinero?lang=${lang}`}>SigueElDinero</Link>
          <Link href="https://github.com/daniel-st3/veedurIA" target="_blank" rel="noreferrer">
            GitHub
          </Link>
          <span>{lang === "es" ? "Datos: SECOP II, CNE, Registraduría" : "Data: SECOP II, CNE, Registraduría"}</span>
          <Link href={`/etica-y-privacidad?lang=${lang}`}>
            {lang === "es" ? "Privacidad y ética" : "Privacy and ethics"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
