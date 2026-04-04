"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
  ArrowUpRight,
  BookOpenText,
  Landmark,
  Quote,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";

import { NoticeStack, type NoticeItem } from "@/components/notice-stack";
import { PromisesAnalytics } from "@/components/promises-analytics";
import { PromisePivotSandbox } from "@/components/promise-pivot-sandbox";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchPromisesOverview } from "@/lib/api";
import { promisesCopy } from "@/lib/copy";
import type { Lang, PromiseCard, PromisesPayload } from "@/lib/types";

type CoveragePeriod = 2018 | 2022 | 2026;
type ChamberKey = "all" | "executive" | "senate" | "house";

type ReferenceCard = {
  id: string;
  name: string;
  role: string;
  period: string;
  chamber: Exclude<ChamberKey, "all">;
  party: string;
  promiseQuote: string;
  outcomeQuote: string;
  sourceLabel: string;
  sourceUrl: string;
  outcomeLabel: string;
  outcomeUrl: string;
  note: string;
};

const PARTY_COLORS: Record<string, string> = {
  "gustavo-petro": "#d08b23",
  "francia-marquez": "#16b1ff",
  "maria-jose-pizarro": "#ef476f",
  "paloma-valencia": "#f2b94b",
  "katherine-miranda": "#5de2a5",
  "inti-asprilla": "#7bb6ff",
  "david-luna": "#a3c6ff",
  "rodrigo-lara": "#ff8f70",
  duque_2018: "#e9bd54",
  petro_2018: "#3cb7ff",
  fajardo_2018: "#8fdc7a",
  cepeda_2026: "#ff9f1c",
  valencia_2026: "#6fa8ff",
  lopez_2026: "#78d7c4",
  espriella_2026: "#ff7b7b",
};

const CYCLE_OPTIONS: Array<{
  value: CoveragePeriod;
  labelEs: string;
  labelEn: string;
  tagEs: string;
  tagEn: string;
}> = [
  { value: 2018, labelEs: "2018-2022", labelEn: "2018-2022", tagEs: "Referencia histórica", tagEn: "Historical reference" },
  { value: 2022, labelEs: "2022-2026", labelEn: "2022-2026", tagEs: "Seguimiento activo", tagEn: "Live tracking" },
  { value: 2026, labelEs: "2026", labelEn: "2026", tagEs: "Radar preelectoral", tagEn: "Pre-electoral radar" },
];

const WIKIPEDIA_PAGES: Record<string, string> = {
  "gustavo-petro": "Gustavo_Petro",
  "francia-marquez": "Francia_M%C3%A1rquez",
  "maria-jose-pizarro": "Mar%C3%ADa_Jos%C3%A9_Pizarro",
  "paloma-valencia": "Paloma_Valencia",
  "katherine-miranda": "Katherine_Miranda",
  "inti-asprilla": "Inti_Asprilla",
  "david-luna": "David_Luna_S%C3%A1nchez",
  "rodrigo-lara": "Rodrigo_Lara_Restrepo",
  duque_2018: "Iv%C3%A1n_Duque_M%C3%A1rquez",
  petro_2018: "Gustavo_Petro",
  fajardo_2018: "Sergio_Fajardo",
  cepeda_2026: "Iv%C3%A1n_Cepeda_Castro",
  valencia_2026: "Paloma_Valencia",
  lopez_2026: "Claudia_L%C3%B3pez_Hern%C3%A1ndez",
  espriella_2026: "Abelardo_De_La_Espriella",
};

const HISTORICAL_REFERENCES: ReferenceCard[] = [
  {
    id: "duque_2018",
    name: "Iván Duque",
    role: "Presidencia",
    period: "2018-2022",
    chamber: "executive",
    party: "Centro Democrático",
    promiseQuote: "“Legalidad, emprendimiento y equidad” como marco para crecimiento, seguridad y reactivación.",
    outcomeQuote: "El ciclo cerró con un PND ejecutado, pero con rezagos visibles en implementación territorial y conflictividad social alta.",
    sourceLabel: "Plan Nacional de Desarrollo 2018-2022",
    sourceUrl: "https://www.dnp.gov.co/Plan-Nacional-de-Desarrollo/Paginas/Plan-Nacional-de-Desarrollo-2018-2022.aspx",
    outcomeLabel: "DNP / cierre del cuatrienio",
    outcomeUrl: "https://www.dnp.gov.co/Plan-Nacional-de-Desarrollo/Paginas/Plan-Nacional-de-Desarrollo-2018-2022.aspx",
    note: "Sirve como referencia histórica para comparar promesa de campaña, plan de gobierno y cierre real del periodo.",
  },
  {
    id: "petro_2018",
    name: "Gustavo Petro",
    role: "Presidencia",
    period: "2018-2022",
    chamber: "executive",
    party: "Colombia Humana",
    promiseQuote: "“Transición energética y cambio del modelo productivo” como eje de campaña presidencial.",
    outcomeQuote: "La promesa quedó en fase programática y se volvió útil como antecedente para comparar con el gobierno iniciado en 2022.",
    sourceLabel: "Programa presidencial 2018",
    sourceUrl: "https://gustavopetro.co/",
    outcomeLabel: "Comparativo con agenda 2022-2026",
    outcomeUrl: "https://gustavopetro.co/",
    note: "En este ciclo funciona como línea base para medir continuidad entre oposición, campaña y gobierno posterior.",
  },
  {
    id: "fajardo_2018",
    name: "Sergio Fajardo",
    role: "Presidencia",
    period: "2018-2022",
    chamber: "executive",
    party: "Centro",
    promiseQuote: "“Educación primero” y gestión pública con foco técnico y territorial.",
    outcomeQuote: "Quedó como referencia programática y permite contrastar cómo envejecen las promesas cuando no pasan a gobierno.",
    sourceLabel: "Propuestas presidenciales 2018",
    sourceUrl: "https://sergiofajardo.co/",
    outcomeLabel: "Seguimiento comparativo",
    outcomeUrl: "https://sergiofajardo.co/",
    note: "Es útil para leer promesas no ejecutadas, promesas retomadas por otros actores y continuidad temática en 2022.",
  },
  {
    id: "angelica_lozano_2018",
    name: "Angélica Lozano",
    role: "Senado",
    period: "2018-2022",
    chamber: "senate",
    party: "Alianza Verde",
    promiseQuote: "“Agenda anticorrupción, transparencia y reforma política con control ciudadano.”",
    outcomeQuote: "Su huella pública del ciclo quedó asociada a debates, agenda anticorrupción y defensa de reformas institucionales visibles en Senado.",
    sourceLabel: "Perfil legislativo 2018",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Sirve para contrastar promesa legislativa con ponencias, debates y agenda pública sostenida durante el cuatrienio.",
  },
  {
    id: "gustavo_bolivar_2018",
    name: "Gustavo Bolívar",
    role: "Senado",
    period: "2018-2022",
    chamber: "senate",
    party: "Lista de la Decencia",
    promiseQuote: "“Oposición, control político y visibilidad del gasto público desde el Senado.”",
    outcomeQuote: "El periodo dejó rastro claro en debates de oposición y denuncias públicas, más que en legislación aprobada propia.",
    sourceLabel: "Perfil legislativo 2018",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Ayuda a leer cómo se mide coherencia cuando el peso principal está en control político y no en ejecución gubernamental.",
  },
  {
    id: "juanita_goebertus_2018",
    name: "Juanita Goebertus",
    role: "Cámara",
    period: "2018-2022",
    chamber: "house",
    party: "Alianza Verde",
    promiseQuote: "“Defensa del Acuerdo de Paz, reformas institucionales y seguimiento a derechos humanos.”",
    outcomeQuote: "El registro visible del periodo concentra debates, proyectos y monitoreo legislativo sobre paz, protesta y seguridad.",
    sourceLabel: "Cámara de Representantes",
    sourceUrl: "https://www.camara.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.camara.gov.co/",
    note: "Es una referencia útil para comparar agenda programática y trabajo de control desde la Cámara.",
  },
  {
    id: "katherine_miranda_2018",
    name: "Katherine Miranda",
    role: "Cámara",
    period: "2018-2022",
    chamber: "house",
    party: "Alianza Verde",
    promiseQuote: "“Fiscalización al gasto, control político y trazabilidad sobre contratación pública.”",
    outcomeQuote: "El ciclo dejó una huella pública más fuerte en debates de vigilancia y exposición de casos que en leyes cerradas.",
    sourceLabel: "Cámara de Representantes",
    sourceUrl: "https://www.camara.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.camara.gov.co/",
    note: "Permite ver cómo envejecen promesas legislativas de vigilancia cuando el resultado principal es visibilización y presión pública.",
  },
];

const LEGISLATIVE_SPOTLIGHTS: ReferenceCard[] = [
  {
    id: "katherine-miranda",
    name: "Katherine Miranda",
    role: "Cámara",
    period: "2022-2026",
    chamber: "house",
    party: "Alianza Verde",
    promiseQuote: "“Más transparencia contractual y mejor control político sobre compras públicas.”",
    outcomeQuote: "Su actividad pública visible se concentra en debates de control y proyectos sobre trazabilidad contractual.",
    sourceLabel: "Cámara de Representantes",
    sourceUrl: "https://www.camara.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.camara.gov.co/",
    note: "Perfil útil para leer promesas anticorrupción y control político con foco contractual.",
  },
  {
    id: "maria-jose-pizarro",
    name: "María José Pizarro",
    role: "Senado",
    period: "2022-2026",
    chamber: "senate",
    party: "Pacto Histórico",
    promiseQuote: "“Paz, garantías democráticas y reformas sociales con seguimiento legislativo.”",
    outcomeQuote: "La evidencia visible se concentra en debates, ponencias y posicionamiento de proyectos en el Senado.",
    sourceLabel: "Senado de la República",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Ayuda a contrastar promesa programática con acción legislativa, no solo con ejecución gubernamental.",
  },
  {
    id: "david-luna",
    name: "David Luna",
    role: "Senado",
    period: "2022-2026",
    chamber: "senate",
    party: "Cambio Radical",
    promiseQuote: "“Control político fuerte, enfoque digital y vigilancia al gasto público.”",
    outcomeQuote: "El seguimiento visible muestra control político, debate público y oposición documentada frente a reformas clave.",
    sourceLabel: "Senado de la República",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Sirve para leer cómo se traducen promesas de oposición en acción parlamentaria verificable.",
  },
];

const RADAR_2026: ReferenceCard[] = [
  {
    id: "cepeda_2026",
    name: "Iván Cepeda",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Pacto Histórico",
    promiseQuote: "Promesas en observación sobre paz, reforma institucional y continuidad de agenda social.",
    outcomeQuote: "Todavía no hay gestión ejecutiva que medir para este ciclo; aquí solo se documenta promesa, fuente y lenguaje programático.",
    sourceLabel: "Perfil público / lanzamiento 2026",
    sourceUrl: "https://www.senado.gov.co/index.php/el-senado/senadores/280-ivan-cepeda-castro",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Radar presidencial 2026: el valor hoy está en leer promesas tempranas y cómo se diferencian antes de la elección.",
  },
  {
    id: "valencia_2026",
    name: "Paloma Valencia",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Centro Democrático",
    promiseQuote: "Promesas en observación sobre seguridad, crecimiento y oposición a reformas estructurales del actual gobierno.",
    outcomeQuote: "En 2026 todavía corresponde leer propuestas, discursos y consistencia programática; no hay ejecución gubernamental que comparar.",
    sourceLabel: "Perfil público / aspiración 2026",
    sourceUrl: "https://www.senado.gov.co/index.php/el-senado/senadores/355-paloma-susana-valencia-laserna",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "El radar 2026 separa promesa pura de evidencia de gobierno para no mezclar campaña con gestión.",
  },
  {
    id: "lopez_2026",
    name: "Claudia López",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas en observación sobre seguridad urbana, gerencia pública y reactivación económica con foco local.",
    outcomeQuote: "La comparación todavía es programática: el módulo muestra fuente, lenguaje y temas dominantes, no cumplimiento.",
    sourceLabel: "Sitio público / candidatura 2026",
    sourceUrl: "https://claudialopez.com/",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "El objetivo aquí es ver qué promete cada candidatura antes de que exista acción pública que medir.",
  },
  {
    id: "espriella_2026",
    name: "Abelardo de la Espriella",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas en observación sobre seguridad, justicia y endurecimiento institucional.",
    outcomeQuote: "No hay resultado que comparar todavía: el tablero los muestra solo como promesas tempranas verificables en fuente pública.",
    sourceLabel: "Sitio público / aspiración 2026",
    sourceUrl: "https://abelardodelaespriella.com/",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Promesa 2026 significa lenguaje de campaña. El cumplimiento empieza a medirse después de la elección y el acceso al cargo.",
  },
  {
    id: "roy_barreras_2026",
    name: "Roy Barreras",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Frente por la Vida",
    promiseQuote: "Promesas tempranas en observación sobre salud, gobernabilidad y continuidad de reformas sociales.",
    outcomeQuote: "El módulo las mantiene como radar de campaña: por ahora solo importan fuente, promesa y consistencia del lenguaje.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Cuando el programa oficial esté disponible, el extractor lo separa en compromisos verificables y comparables con el resto del tablero.",
  },
  {
    id: "lizcano_2026",
    name: "Mauricio Lizcano",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas tempranas en observación sobre tecnología pública, conectividad y competitividad territorial.",
    outcomeQuote: "La lectura todavía es preelectoral: fuente, promesa visible y consistencia del lenguaje, no cumplimiento.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "La etapa útil hoy es capturar el programa y extraer compromisos frase por frase antes de que exista gestión ejecutiva.",
  },
  {
    id: "murillo_2026",
    name: "Luis Gilberto Murillo",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas tempranas en observación sobre transición energética, diplomacia climática y gerencia pública.",
    outcomeQuote: "Todavía no hay gestión de este ciclo que contrastar. Aquí solo se documentan lenguaje programático y fuente pública disponible.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "En cuanto aparezca un programa descargable, el extractor parte el texto en compromisos y clasifica cada frase por tema.",
  },
  {
    id: "fajardo_2026",
    name: "Sergio Fajardo",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Centro",
    promiseQuote: "Promesas tempranas en observación sobre educación, seguridad urbana y gestión territorial.",
    outcomeQuote: "El módulo las mantiene en radar preelectoral y no las mezcla todavía con ejecución o cumplimiento.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "El valor actual está en extraer temas, verbos y metas cuando el programa oficial esté público y descargable.",
  },
  {
    id: "clara_lopez_2026",
    name: "Clara López",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Coalición progresista",
    promiseQuote: "Promesas tempranas en observación sobre empleo, reindustrialización y protección social.",
    outcomeQuote: "En esta fase todavía no hay acción ejecutiva asociada. La lectura es programática y comparativa.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "La comparación útil por ahora es entre tono, prioridades y detalle programático frente al resto del radar presidencial.",
  },
  {
    id: "miguel_uribe_2026",
    name: "Miguel Uribe",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Centro Democrático",
    promiseQuote: "Promesas tempranas en observación sobre seguridad, crecimiento económico y reforma del Estado.",
    outcomeQuote: "Todavía corresponde documentar promesas y fuentes, no medir cumplimiento.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Cuando haya texto programático completo, el extractor NLP lo separa por compromisos y permite compararlo con otros candidatos.",
  },
  {
    id: "caicedo_2026",
    name: "Carlos Caicedo",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Fuerza Ciudadana",
    promiseQuote: "Promesas tempranas en observación sobre descentralización, Caribe y justicia social territorial.",
    outcomeQuote: "La lectura sigue siendo de campaña: fuente pública, lenguaje y foco temático.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "La capa útil hoy es radar comparativo: qué promete, con qué nivel de detalle y en qué temas insiste.",
  },
  {
    id: "sondra_macollins_2026",
    name: "Sondra Macollins",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas tempranas en observación desde fuentes abiertas y lanzamientos públicos de campaña.",
    outcomeQuote: "Aún no existe ejecución que medir; el tablero conserva solo referencia de fuente y perfil político.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Mientras no exista programa descargable, el módulo deja explícito que la cobertura es de radar y no de cumplimiento.",
  },
  {
    id: "santiago_botero_2026",
    name: "Santiago Botero",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas tempranas en observación desde apariciones públicas y referencias abiertas.",
    outcomeQuote: "No hay ejecución asociada todavía. Solo se documenta la etapa programática inicial.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Este radar sirve para detectar cuándo aparece un programa más completo que se pueda extraer automáticamente.",
  },
  {
    id: "matamoros_2026",
    name: "Gustavo Matamoros",
    role: "Presidencia",
    period: "2026",
    chamber: "executive",
    party: "Por firmas",
    promiseQuote: "Promesas tempranas en observación sobre seguridad, gerencia y orden institucional.",
    outcomeQuote: "La lectura se mantiene programática hasta que exista acción pública posterior a la elección.",
    sourceLabel: "Referencia pública 2026",
    sourceUrl: "https://www.registraduria.gov.co/",
    outcomeLabel: "Sin ejecución 2026",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Por ahora el tablero distingue claramente entre promesa temprana y cumplimiento para no mezclar campaña con gobierno.",
  },
];

const SOURCE_MATRIX = {
  es: [
    { label: "Promesas", detail: "Programas de gobierno, planes públicos, discursos, entrevistas, perfiles legislativos y documentos de campaña descargables." },
    { label: "Congreso y gobierno", detail: "Senado, Cámara, gacetas, ministerios, leyes, decretos, proyectos, votaciones y registros oficiales consultables." },
    { label: "Cobertura electoral", detail: "Registraduría, resultados públicos, perfiles oficiales, portales de campaña y referencias abiertas del ciclo 2026." },
    { label: "Extracción NLP", detail: "Cada documento se parte en frases-promesa, verbos, metas y subcompromisos para ampliar la cobertura visible por actor y tema." },
  ],
  en: [
    { label: "Promises", detail: "Government plans, legislative profiles, speeches, public pages, and downloadable campaign documents." },
    { label: "Congress and government", detail: "Senate, House, gazettes, ministries, laws, decrees, bills, votes, and official registries." },
    { label: "Electoral coverage", detail: "Election authority references, public results, campaign portals, and open profiles for the 2026 cycle." },
    { label: "NLP extraction", detail: "Each document is split into promise sentences, verbs, goals, and sub-commitments to broaden visible coverage by actor and theme." },
  ],
};

function buildReferenceHighlights(item: ReferenceCard, lang: Lang) {
  return [
    {
      label: lang === "es" ? "Promesa visible" : "Visible promise",
      value: item.promiseQuote,
    },
    {
      label: lang === "es" ? "Qué deja el ciclo" : "Cycle outcome",
      value: item.outcomeQuote,
    },
    {
      label: lang === "es" ? "Cómo leerlo" : "How to read it",
      value: item.note,
    },
  ];
}

function getColor(id: string) {
  if (PARTY_COLORS[id]) return PARTY_COLORS[id];
  const palette = ["#f0c351", "#5de2a5", "#7bb6ff", "#ff8f70", "#9d7bff", "#ff6f91", "#38bdf8"];
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function fallbackPortrait(name: string, color: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="#08111f" />
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="48" fill="url(#g)" />
      <circle cx="320" cy="240" r="126" fill="rgba(255,255,255,0.12)" />
      <path d="M164 542c34-98 98-146 156-146s122 48 156 146" fill="rgba(255,255,255,0.18)" />
      <text x="320" y="352" text-anchor="middle" font-size="148" font-family="Arial, sans-serif" font-weight="700" fill="#f5efe1">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function chamberKeyFromText(text: string): Exclude<ChamberKey, "all"> {
  const normalized = text.toLowerCase();
  if (normalized.includes("cámara") || normalized.includes("camara") || normalized.includes("representante")) {
    return "house";
  }
  if (normalized.includes("senado") || normalized.includes("senador")) {
    return "senate";
  }
  return "executive";
}

function chamberLabel(lang: Lang, chamber: Exclude<ChamberKey, "all">) {
  if (chamber === "executive") return lang === "es" ? "Presidencia / Ejecutivo" : "Presidency / Executive";
  if (chamber === "senate") return lang === "es" ? "Senado" : "Senate";
  return lang === "es" ? "Cámara" : "House";
}

function getStatusMeta(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      tone: "green",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "Hay una acción pública claramente conectada con esta promesa."
          : "There is a public action clearly connected with this promise.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      tone: "yellow",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "Existe movimiento relacionado, pero todavía parcial o incompleto."
          : "There is related movement, but it remains partial or incomplete.",
    };
  }
  return {
    tone: "muted",
    label: card.statusLabel,
    summary:
      lang === "es"
        ? "No aparece evidencia suficiente dentro de la cobertura visible."
        : "No sufficient evidence appears inside the visible coverage.",
  };
}

function getSemanticReadout(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      title: lang === "es" ? "Coincidencia alta" : "High match",
      body:
        lang === "es"
          ? "La promesa y la acción pública comparten tema, verbo y objetivo. Por eso la coincidencia sube y el caso se marca como evidencia fuerte."
          : "The promise and the public action share topic, verb, and objective. That is why the match rises and the case is marked as strong evidence.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      title: lang === "es" ? "Coincidencia parcial" : "Partial match",
      body:
        lang === "es"
          ? "Se encontró una acción relacionada, pero todavía cubre solo una parte de la promesa o sigue en trámite."
          : "A related action was found, but it still covers only part of the promise or remains in progress.",
    };
  }
  return {
    title: lang === "es" ? "Sin evidencia cercana" : "No close evidence",
    body:
      lang === "es"
        ? "La cobertura actual no encontró una acción pública suficientemente parecida para sostener el vínculo."
        : "The current coverage did not find a sufficiently similar public action to sustain the link.",
  };
}

export function PromisesView({
  lang,
  initialPayload,
}: {
  lang: Lang;
  initialPayload: PromisesPayload | null;
}) {
  const scope = useRef<HTMLDivElement | null>(null);
  const copy = promisesCopy[lang];
  const defaultId = initialPayload?.scorecard.politicianId ?? initialPayload?.options.politicians[0]?.value;
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultId);
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activePeriod, setActivePeriod] = useState<CoveragePeriod>(2022);
  const [activeChamber, setActiveChamber] = useState<ChamberKey>("all");
  const [payload, setPayload] = useState<PromisesPayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [openCardId, setOpenCardId] = useState<string | null>(initialPayload?.cards[0]?.id ?? null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(Boolean(initialPayload));
  const [activeHistoricalId, setActiveHistoricalId] = useState<string | null>(HISTORICAL_REFERENCES[0]?.id ?? null);
  const [activeRadarId, setActiveRadarId] = useState<string | null>(RADAR_2026[0]?.id ?? null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const pushNotice = (tone: NoticeItem["tone"], message: string, title?: string) => {
    const id = `${tone}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotices((current) => [...current, { id, tone, title, message }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id));
    }, tone === "error" ? 5000 : 3200);
  };

  useEffect(() => {
    if (initialized) {
      setInitialized(false);
      return;
    }

    if (activePeriod !== 2022) return;
    if (!selectedId) return;

    let alive = true;
    setLoading(true);
    fetchPromisesOverview({
      lang,
      politicianId: selectedId,
      domain: domainFilter,
      status: statusFilter,
      electionYear: 2022,
      chamber: activeChamber === "all" ? undefined : activeChamber,
      limit: 48,
    })
      .then((data) => {
        if (!alive) return;
        setPayload(data);
        setOpenCardId(data.cards[0]?.id ?? null);
      })
      .catch(() => {
        if (!alive) return;
        pushNotice(
          "error",
          lang === "es" ? "No fue posible actualizar el seguimiento del actor." : "The actor tracking view could not be refreshed.",
          lang === "es" ? "Error de carga" : "Loading error",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedId, domainFilter, statusFilter, lang, initialized, activePeriod, activeChamber]);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;
      gsap.fromTo(
        ".pmr-hero, .pmr-cycle-bar, .pmr-board, .pmr-reference-stage, .pmr-reference-section, .pmr-politician-card, .pmr-promise-card, .pmr-analytics-card, .pmr-source-band__card",
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 0.64, stagger: 0.03, ease: "power3.out" },
      );
      gsap.fromTo(
        ".pmr-domain-bars__track span",
        { width: 0 },
        {
          width: (_index, target) => target.getAttribute("data-width") || "100%",
          duration: 1.05,
          ease: "power3.out",
          stagger: 0.05,
        },
      );
      gsap.fromTo(
        ".pmr-progress-ring__meter",
        { strokeDashoffset: 320 },
        { strokeDashoffset: (_index, target) => Number(target.getAttribute("data-offset") ?? 0), duration: 1.4, ease: "power3.inOut" },
      );
    },
    { scope, dependencies: [activePeriod, activeChamber, payload?.cards.length ?? 0, payload?.scorecard.overallScore ?? 0] },
  );

  const politicians = payload?.options.politicians ?? [];
  const chamberOptions = useMemo(() => {
    const fromPoliticians = politicians.map((politician) => chamberKeyFromText(politician.label));
    const fromHistorical = HISTORICAL_REFERENCES.map((item) => item.chamber);
    const fromRadar = RADAR_2026.map((item) => item.chamber);
    const set = new Set<Exclude<ChamberKey, "all">>();
    const pool = activePeriod === 2022 ? fromPoliticians : activePeriod === 2018 ? fromHistorical : fromRadar;
    pool.forEach((item) => set.add(item));
    return [...set];
  }, [activePeriod, politicians]);

  const visiblePoliticians = useMemo(
    () =>
      politicians.filter((politician) =>
        activeChamber === "all" ? true : chamberKeyFromText(politician.label) === activeChamber,
      ),
    [activeChamber, politicians],
  );

  useEffect(() => {
    if (activeChamber === "all") return;
    if (!chamberOptions.includes(activeChamber)) {
      setActiveChamber("all");
    }
  }, [activeChamber, chamberOptions]);

  useEffect(() => {
    if (activePeriod !== 2022) return;
    const firstVisible = visiblePoliticians[0]?.value;
    if (!firstVisible) return;
    if (!selectedId || !visiblePoliticians.some((item) => item.value === selectedId)) {
      setSelectedId(firstVisible);
    }
  }, [activePeriod, selectedId, visiblePoliticians]);

  const cards = payload?.cards ?? [];
  const sandboxCards = payload?.sandboxCards ?? cards;
  const scorecard = payload?.scorecard;
  const openCard = cards.find((card) => card.id === openCardId) ?? null;
  const visibleHistorical = useMemo(
    () => HISTORICAL_REFERENCES.filter((item) => (activeChamber === "all" ? true : item.chamber === activeChamber)),
    [activeChamber],
  );
  const visibleRadar = useMemo(
    () => RADAR_2026.filter((item) => (activeChamber === "all" ? true : item.chamber === activeChamber)),
    [activeChamber],
  );

  useEffect(() => {
    if (activePeriod !== 2018) return;
    const fallback = visibleHistorical[0]?.id ?? null;
    if (!fallback) return;
    if (!visibleHistorical.some((item) => item.id === activeHistoricalId)) {
      setActiveHistoricalId(fallback);
    }
  }, [activeHistoricalId, activePeriod, visibleHistorical]);

  useEffect(() => {
    if (activePeriod !== 2026) return;
    const fallback = visibleRadar[0]?.id ?? null;
    if (!fallback) return;
    if (!visibleRadar.some((item) => item.id === activeRadarId)) {
      setActiveRadarId(fallback);
    }
  }, [activePeriod, activeRadarId, visibleRadar]);

  const activeHistorical = visibleHistorical.find((item) => item.id === activeHistoricalId) ?? visibleHistorical[0] ?? null;
  const activeRadar = visibleRadar.find((item) => item.id === activeRadarId) ?? visibleRadar[0] ?? null;
  const portraitTargets = useMemo(
    () => [
      ...visiblePoliticians.map((politician) => {
        const name = politician.label.split(" · ")[0] ?? politician.label;
        return { id: politician.value, name };
      }),
      ...HISTORICAL_REFERENCES.map((item) => ({ id: item.id, name: item.name })),
      ...RADAR_2026.map((item) => ({ id: item.id, name: item.name })),
    ],
    [visiblePoliticians],
  );

  useEffect(() => {
    const relevant = portraitTargets.filter((item) => WIKIPEDIA_PAGES[item.id]);
    if (!relevant.length) return;

    let cancelled = false;
    Promise.all(
      relevant.map(async (item) => {
        try {
          const response = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${WIKIPEDIA_PAGES[item.id]}`);
          if (!response.ok) return [item.id, ""] as const;
          const data = await response.json();
          return [item.id, data?.thumbnail?.source ?? ""] as const;
        } catch {
          return [item.id, ""] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setPortraits((current) => {
        const next = { ...current };
        rows.forEach(([id, src]) => {
          if (src) next[id] = src;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [portraitTargets]);

  const selectedPoliticianLabel = useMemo(
    () => politicians.find((item) => item.value === selectedId)?.label ?? "",
    [politicians, selectedId],
  );

  const selectedRole = selectedPoliticianLabel.split(" · ")[1] ?? scorecard?.chamber ?? "";
  const partyColor = getColor(selectedId ?? "");
  const trackedPortrait = scorecard
    ? portraits[scorecard.politicianId] || fallbackPortrait(scorecard.politicianName, partyColor)
    : fallbackPortrait("VeedurIA", "#f0c351");
  const activeReference = activePeriod === 2018 ? activeHistorical : activeRadar;
  const activeReferenceColor = getColor(activeReference?.id ?? "reference");
  const activeReferencePortrait = activeReference
    ? portraits[activeReference.id] || fallbackPortrait(activeReference.name, activeReferenceColor)
    : fallbackPortrait("VeedurIA", "#f0c351");
  const periodTitle =
    activePeriod === 2022
      ? lang === "es"
        ? "Seguimiento 2022-2026"
        : "2022-2026 tracking"
      : activePeriod === 2018
        ? lang === "es"
          ? "Referencias 2018-2022"
          : "2018-2022 references"
        : lang === "es"
          ? "Radar 2026"
          : "2026 radar";
  const periodBody =
    activePeriod === 2022
      ? lang === "es"
        ? "Aquí sí se compara promesa con acción pública visible y se puede bajar al detalle por actor, dominio y estado."
        : "Here the board does compare promises against visible public action, with drill-down by actor, domain, and status."
      : activePeriod === 2018
        ? lang === "es"
          ? "Este corte sirve como referencia histórica: cómo envejecieron promesas y qué huella pública dejaron en el cierre del periodo."
          : "This slice works as a historical reference: how promises aged and what public footprint they left by the end of the cycle."
        : lang === "es"
          ? "En 2026 todavía no corresponde medir cumplimiento. El tablero separa promesa temprana, fuente pública y etapa preelectoral."
          : "In 2026 it is still too early to measure compliance. The board separates early promises, public source, and pre-electoral stage.";
  const periodProfiles =
    activePeriod === 2022 ? visiblePoliticians.length : activePeriod === 2018 ? visibleHistorical.length : visibleRadar.length;
  const periodRecords =
    activePeriod === 2022 ? payload?.kpis.promisesTracked ?? 0 : activePeriod === 2018 ? visibleHistorical.length : visibleRadar.length;
  const visibleSourceCount =
    activePeriod === 2022
      ? new Set(
          sandboxCards
            .flatMap((card) => [card.promiseSourceUrl, card.actionSourceUrl])
            .filter((value) => value && value !== "#"),
        ).size
      : (activePeriod === 2018 ? visibleHistorical.length : visibleRadar.length) * 2;
  const visibleCountsByPolitician = useMemo(() => {
    const buckets = new Map<string, number>();
    sandboxCards.forEach((card) => {
      buckets.set(card.politicianId, (buckets.get(card.politicianId) ?? 0) + 1);
    });
    return buckets;
  }, [sandboxCards]);
  const ringCircumference = 2 * Math.PI * 46;
  const ringOffset = scorecard ? ringCircumference * (1 - scorecard.overallScore / 100) : ringCircumference;

  return (
    <div className="shell" ref={scope}>
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
          { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
          { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
        ]}
      />
      <NoticeStack notices={notices} onDismiss={(id) => setNotices((current) => current.filter((item) => item.id !== id))} />

      <main className="page pmr-page">
        <section className="pmr-hero">
          <div className="pmr-hero__copy">
            <p className="eyebrow">{lang === "es" ? "Promesas, evidencia y comparación" : "Promises, evidence, and comparison"}</p>
            <h1>{periodTitle}</h1>
            <p className="pmr-hero__body">{periodBody}</p>
          </div>

          <div className="pmr-hero__stats stats-grid">
            <article>
              <span>{lang === "es" ? "Perfiles visibles" : "Visible profiles"}</span>
              <strong>{periodProfiles}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Registros visibles" : "Visible records"}</span>
              <strong>{periodRecords}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Fuentes visibles" : "Visible sources"}</span>
              <strong>{visibleSourceCount}</strong>
            </article>
            <article>
              <span>{activePeriod === 2022 ? copy.kpiCoherence : lang === "es" ? "Periodo activo" : "Active cycle"}</span>
              <strong>{activePeriod === 2022 ? `${payload?.kpis.coherenceRate ?? 0}%` : periodTitle}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Cámara activa" : "Active chamber"}</span>
              <strong>{activeChamber === "all" ? (lang === "es" ? "Todas" : "All") : chamberLabel(lang, activeChamber)}</strong>
            </article>
          </div>
        </section>

        <section className="pmr-cycle-bar surface-soft">
          <div className="pmr-cycle-tabs">
            {CYCLE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`pmr-cycle-tab ${activePeriod === item.value ? "pmr-cycle-tab--active" : ""}`}
                onClick={() => setActivePeriod(item.value)}
              >
                <span>{lang === "es" ? "Periodo" : "Cycle"}</span>
                <strong>{lang === "es" ? item.labelEs : item.labelEn}</strong>
                <em>{lang === "es" ? item.tagEs : item.tagEn}</em>
              </button>
            ))}
          </div>

          <div className="pmr-chamber-pills">
            <button
              type="button"
              className={`pmr-chamber-pill ${activeChamber === "all" ? "pmr-chamber-pill--active" : ""}`}
              onClick={() => setActiveChamber("all")}
            >
              {lang === "es" ? "Todas las cámaras" : "All chambers"}
            </button>
            {chamberOptions.map((item) => (
              <button
                key={item}
                type="button"
                className={`pmr-chamber-pill ${activeChamber === item ? "pmr-chamber-pill--active" : ""}`}
                onClick={() => setActiveChamber(item)}
              >
                {chamberLabel(lang, item)}
              </button>
            ))}
          </div>
        </section>

        {activePeriod === 2022 ? (
          <section className="pmr-board">
            <div className="pmr-board__top">
              <div className="pmr-board__note">
                <span>{lang === "es" ? "Qué estás viendo" : "What you are seeing"}</span>
                <strong>{periodTitle}</strong>
                <p>{payload?.meta.pilotNote ?? ""}</p>
              </div>

              <div className="pmr-filter-row">
                <label className="pmr-filter">
                  <span>{copy.filterDomain}</span>
                  <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                    {(payload?.options.domains ?? []).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pmr-filter">
                  <span>{copy.filterStatus}</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    {(payload?.options.statuses ?? []).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="pmr-politician-strip profiles-grid">
              {visiblePoliticians.map((politician) => {
                const isActive = politician.value === selectedId;
                const name = politician.label.split(" · ")[0] ?? politician.label;
                const role = politician.label.split(" · ")[1] ?? "";
                const fallback = fallbackPortrait(name, getColor(politician.value));
                const portrait = portraits[politician.value] || fallback;

                return (
                  <button
                    key={politician.value}
                    type="button"
                    className={`pmr-politician-card ${isActive ? "pmr-politician-card--active" : ""}`}
                    onClick={() => {
                      setSelectedId(politician.value);
                      pushNotice(
                        "info",
                        lang === "es"
                          ? `${visibleCountsByPolitician.get(politician.value) ?? 0} registros visibles para ${name}.`
                          : `${visibleCountsByPolitician.get(politician.value) ?? 0} visible records for ${name}.`,
                        name,
                      );
                    }}
                    style={isActive ? { borderColor: getColor(politician.value) } : undefined}
                    >
                      <div className="pmr-politician-card__media">
                        <img
                          src={portrait}
                          alt={name}
                        className="pmr-politician-card__img"
                        onError={(event) => {
                          event.currentTarget.src = fallback;
                        }}
                      />
                    </div>
                    <div>
                      <strong>{name}</strong>
                      <span>{role}</span>
                      <small>{(visibleCountsByPolitician.get(politician.value) ?? 0).toLocaleString("es-CO")} {lang === "es" ? "registros" : "records"}</small>
                    </div>
                  </button>
                );
              })}
            </div>

            {scorecard ? (
              <section className="pmr-spotlight">
                <div className="pmr-spotlight__media">
                  <img
                    src={trackedPortrait}
                    alt={scorecard.politicianName}
                    className="pmr-spotlight__img"
                    onError={(event) => {
                      event.currentTarget.src = fallbackPortrait(scorecard.politicianName, partyColor);
                    }}
                  />
                  <div className="pmr-spotlight__overlay" />
                </div>

                <div className="pmr-spotlight__content">
                  <div className="pmr-spotlight__person">
                    <div>
                      <span className="pmr-spotlight__role">{selectedRole || scorecard.chamber}</span>
                      <h2>{scorecard.politicianName}</h2>
                      <p>{scorecard.party}</p>
                    </div>

                    <div className="pmr-spotlight__score">
                      <div className="pmr-spotlight__score-ring" style={{ color: partyColor }}>
                        <svg viewBox="0 0 120 120" className="pmr-progress-ring" aria-hidden="true">
                          <circle className="pmr-progress-ring__track" cx="60" cy="60" r="46" />
                          <circle
                            className="pmr-progress-ring__meter"
                            cx="60"
                            cy="60"
                            r="46"
                            stroke={partyColor}
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                            data-offset={ringOffset}
                          />
                        </svg>
                        <div className="pmr-progress-ring__value">{scorecard.overallScore}%</div>
                      </div>
                      <div>
                        <span>{lang === "es" ? "lectura de coherencia" : "coherence read"}</span>
                        <strong>{lang === "es" ? "promesa vs acción observable" : "promise vs observable action"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pmr-spotlight__counts coherence-boxes">
                    <article className="coherence-box">
                      <span className="coherence-label">{copy.scoreFulfilled}</span>
                      <strong className="coherence-number">{scorecard.statusCounts.fulfilled}</strong>
                    </article>
                    <article className="coherence-box">
                      <span className="coherence-label">{copy.scoreMonitoring}</span>
                      <strong className="coherence-number">{scorecard.statusCounts.monitoring}</strong>
                    </article>
                    <article className="coherence-box">
                      <span className="coherence-label">{copy.scoreNoAction}</span>
                      <strong className="coherence-number">{scorecard.statusCounts.noAction}</strong>
                    </article>
                  </div>

                  <div className="pmr-domain-bars">
                    {scorecard.domains.map((domain) => (
                      <article key={domain.key} className="pmr-domain-bars__item">
                        <div className="pmr-domain-bars__head">
                          <span>{domain.label}</span>
                          <strong>{Math.round(domain.score * 100)}%</strong>
                        </div>
                        <div className="pmr-domain-bars__track">
                          <span
                            data-width={`${Math.max(8, domain.score * 100)}%`}
                            style={{ width: `${Math.max(8, domain.score * 100)}%`, background: partyColor }}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {scorecard ? <PromisesAnalytics lang={lang} scorecard={scorecard} cards={cards} /> : null}

            <section className="pmr-promise-wall">
              <div className="pmr-promise-wall__header">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Promesas rastreadas" : "Tracked promises"}</p>
                  <h2>{lang === "es" ? "Promesa, evidencia y lectura comparada" : "Promise, evidence, and compared reading"}</h2>
                </div>
                <span>{cards.length} {lang === "es" ? "registros visibles" : "visible records"}</span>
              </div>

              {loading ? (
                <div className="pmr-loading-grid" aria-live="polite">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <article key={`promise-skeleton-${index}`} className="pmr-loading-card">
                      <div className="skeleton skeleton--pill" style={{ width: 120, marginBottom: 12 }} />
                      <div className="skeleton skeleton--title" style={{ width: "86%", marginBottom: 12, height: 28 }} />
                      <div className="skeleton skeleton--line" style={{ width: "100%", marginBottom: 8 }} />
                      <div className="skeleton skeleton--line" style={{ width: "72%" }} />
                    </article>
                  ))}
                </div>
              ) : cards.length === 0 ? (
                <div className="surface-soft" style={{ padding: "2rem", textAlign: "center" }}>{copy.cardsEmpty}</div>
              ) : (
                <div className="pmr-card-grid">
                  {cards.map((card) => {
                    const meta = getStatusMeta(card, lang);
                    const isActive = openCardId === card.id;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`pmr-promise-card ${isActive ? "pmr-promise-card--active" : ""}`}
                        onClick={() => setOpenCardId(card.id)}
                      >
                        <div className="pmr-promise-card__top">
                          <span className={`pmr-status-dot pmr-status-dot--${meta.tone}`} />
                          <span className={`pmr-status-pill pmr-status-pill--${meta.tone}`}>{meta.label}</span>
                          <strong>{card.similarityScore}%</strong>
                        </div>
                        <h3>{card.promiseText}</h3>
                        <p>{meta.summary}</p>
                        <div className="pmr-promise-card__meta">
                          <span>{card.domainLabel}</span>
                          <span>{card.actionDate || "—"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {openCard ? (
              <section className="pmr-detail">
                <div className="pmr-detail__header">
                  <div>
                    <p className="eyebrow">{lang === "es" ? "Lectura detallada" : "Detailed readout"}</p>
                    <h2>{openCard.promiseText}</h2>
                  </div>
                  <div className="pmr-detail__scorebox">
                    <span>{lang === "es" ? "similitud" : "similarity"}</span>
                    <strong>{openCard.similarityScore}%</strong>
                  </div>
                </div>

                <div className="pmr-quote-grid">
                  <article className="pmr-quote-card">
                    <div className="pmr-detail-card__label">
                      <Quote size={15} />
                      {lang === "es" ? "Lo prometido" : "What was promised"}
                    </div>
                    <p>“{openCard.promiseText}”</p>
                  </article>
                  <article className="pmr-quote-card">
                    <div className="pmr-detail-card__label">
                      <Quote size={15} />
                      {lang === "es" ? "Lo observado" : "What was observed"}
                    </div>
                    <p>“{openCard.actionSummary || copy.noEvidence}”</p>
                  </article>
                </div>

                <div className="pmr-detail__grid">
                  <article className="pmr-detail-card">
                    <div className="pmr-detail-card__label">
                      <BookOpenText size={15} />
                      {lang === "es" ? "Fuente de la promesa" : "Promise source"}
                    </div>
                    <strong>{openCard.promiseSourceLabel}</strong>
                    <p>{openCard.promiseText}</p>
                    <a href={openCard.promiseSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                      {copy.verifyPromise} <ArrowUpRight size={14} />
                    </a>
                  </article>

                  <article className="pmr-detail-card">
                    <div className="pmr-detail-card__label">
                      <Landmark size={15} />
                      {lang === "es" ? "Fuente de la acción" : "Action source"}
                    </div>
                    <strong>{openCard.actionTitle}</strong>
                    <p>{openCard.actionSummary || copy.noEvidence}</p>
                    <a href={openCard.actionSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                      {copy.verifyAction} <ArrowUpRight size={14} />
                    </a>
                  </article>

                  <article className="pmr-detail-card pmr-detail-card--analysis">
                    <div className="pmr-detail-card__label">
                      <ScanSearch size={15} />
                      {lang === "es" ? "Cómo se enlaza" : "How the link is built"}
                    </div>
                    <strong>{getSemanticReadout(openCard, lang).title}</strong>
                    <p>{getSemanticReadout(openCard, lang).body}</p>
                    <div className="pmr-metric-list">
                      <div>
                        <span>{copy.extraction}</span>
                        <strong>{openCard.extractionConfidence}%</strong>
                      </div>
                      <div>
                        <span>{copy.confidence}</span>
                        <strong>{openCard.statusConfidence}%</strong>
                      </div>
                      <div>
                        <span>{lang === "es" ? "fuente de acción" : "action source"}</span>
                        <strong>{openCard.actionSourceSystem || "—"}</strong>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            <PromisePivotSandbox lang={lang} cards={sandboxCards} />
          </section>
        ) : activeReference ? (
          <section className={`pmr-reference-stage ${activePeriod === 2026 ? "pmr-reference-stage--dark surface" : "surface-soft"}`}>
            <div className="pmr-section-header">
              <div>
                <p className="eyebrow">{activePeriod === 2018 ? (lang === "es" ? "Referencias 2018-2022" : "2018-2022 references") : (lang === "es" ? "Radar 2026" : "2026 radar")}</p>
                <h2>
                  {activePeriod === 2018
                    ? lang === "es"
                      ? "Perfiles históricos para comparar ciclo, cámara y huella pública"
                      : "Historical profiles to compare cycle, chamber, and public footprint"
                    : lang === "es"
                      ? "Promesa temprana, fuente pública y seguimiento preelectoral"
                      : "Early promise, public source, and pre-electoral tracking"}
                </h2>
              </div>
              <p>{periodBody}</p>
            </div>

            <div className="pmr-reference-picker">
              {(activePeriod === 2018 ? visibleHistorical : visibleRadar).map((item) => {
                const isActive = item.id === activeReference.id;
                const fallback = fallbackPortrait(item.name, getColor(item.id));
                const portrait = portraits[item.id] || fallback;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pmr-reference-choice ${isActive ? "pmr-reference-choice--active" : ""}`}
                    onClick={() => (activePeriod === 2018 ? setActiveHistoricalId(item.id) : setActiveRadarId(item.id))}
                    style={isActive ? { borderColor: getColor(item.id) } : undefined}
                  >
                    <img
                      src={portrait}
                      alt={item.name}
                      onError={(event) => {
                        event.currentTarget.src = fallback;
                      }}
                    />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.role}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <article className="pmr-reference-focus">
              <div className="pmr-reference-focus__media">
                <img
                  src={activeReferencePortrait}
                  alt={activeReference.name}
                  onError={(event) => {
                    event.currentTarget.src = fallbackPortrait(activeReference.name, activeReferenceColor);
                  }}
                />
                <span style={{ background: `linear-gradient(180deg, transparent, ${activeReferenceColor})` }} />
              </div>
              <div className="pmr-reference-focus__body">
                <small>{activeReference.period} · {activeReference.role}</small>
                <h3>{activeReference.name}</h3>
                <div className="pmr-quote-grid">
                  <article className="pmr-quote-card">
                    <div className="pmr-detail-card__label">
                      <Quote size={15} />
                      {lang === "es" ? "Lo prometido" : "What was promised"}
                    </div>
                    <p>“{activeReference.promiseQuote}”</p>
                  </article>
                  <article className="pmr-quote-card">
                    <div className="pmr-detail-card__label">
                      <Quote size={15} />
                      {lang === "es" ? "Lo observado" : "What was observed"}
                    </div>
                    <p>“{activeReference.outcomeQuote}”</p>
                  </article>
                </div>

                <div className="pmr-reference-insights">
                  {buildReferenceHighlights(activeReference, lang).map((item) => (
                    <article key={item.label} className="pmr-reference-insights__card">
                      <span>{item.label}</span>
                      <p>{item.value}</p>
                    </article>
                  ))}
                </div>
                <div className="pmr-reference-card__links">
                  <a href={activeReference.sourceUrl} target="_blank" rel="noreferrer">{activeReference.sourceLabel}</a>
                  <a href={activeReference.outcomeUrl} target="_blank" rel="noreferrer">{activeReference.outcomeLabel}</a>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        <section className="pmr-reference-section surface-soft">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Fuentes del módulo" : "Module sources"}</p>
              <h2>{lang === "es" ? "De dónde sale la información" : "Where the information comes from"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Cada tarjeta conserva su fuente de promesa, su fuente de acción y la ruta mínima para contrastar lo que sí aparece en el periodo."
                : "Each card keeps its promise source, action source, and the minimum trail needed to contrast what actually appears in the cycle."}
            </p>
          </div>

          <div className="pmr-source-grid">
              {SOURCE_MATRIX[lang].map((item) => (
                <article key={item.label} className="pmr-source-card">
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </article>
            ))}
          </div>
        </section>

        <section className="pmr-reference-section surface">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Cómo leer el cruce" : "How to read the match"}</p>
              <h2>{lang === "es" ? "Qué compara este tablero" : "What this board compares"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "La lectura compara promesa, acción pública y peso de la evidencia. Así se puede distinguir entre avance claro, movimiento parcial y ausencia de rastro visible."
                : "The readout compares promise, public action, and evidence weight. That helps separate clear progress, partial movement, and the absence of a visible trace."}
            </p>
          </div>

          <div className="pmr-method-grid">
            <article className="pmr-method-card">
              <ShieldCheck size={18} />
              <strong>{lang === "es" ? "Tema y verbo principal" : "Topic and main verb"}</strong>
              <p>{lang === "es" ? "El extractor identifica de qué habla la promesa y qué tipo de acción propone: aprobar, crear, financiar, reglamentar, vigilar o ejecutar." : "The extractor identifies what the promise is about and which action verb it uses: approve, create, fund, regulate, oversee, or execute."}</p>
            </article>
            <article className="pmr-method-card">
              <Users size={18} />
              <strong>{lang === "es" ? "Objetivo y alcance" : "Objective and scope"}</strong>
              <p>{lang === "es" ? "Luego compara si la acción pública apunta al mismo objetivo material: cambiar una ley, mover presupuesto, abrir cobertura, ejercer control o ejecutar una política." : "It then compares whether the public action points to the same material objective: change a law, move budget, expand coverage, exercise oversight, or execute a policy."}</p>
            </article>
            <article className="pmr-method-card">
              <ScanSearch size={18} />
              <strong>{lang === "es" ? "Peso de la evidencia" : "Evidence weight"}</strong>
              <p>{lang === "es" ? "Una ley aprobada pesa más que una ponencia; una ponencia más que un debate; un debate más que una declaración suelta. Por eso no todo match vale lo mismo." : "An approved law weighs more than a bill draft; a bill draft more than a debate; a debate more than a loose statement. That is why not every match carries the same weight."}</p>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
