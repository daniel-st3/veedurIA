/**
 * Mock data layer — used as fallback when the FastAPI backend is unreachable.
 * All numbers are illustrative estimates; real values come from the live API.
 */

import type {
  ContractsFreshnessPayload,
  OverviewPayload,
  PromisesPayload,
  TablePayload,
} from "./types";
import type { ContractsFilters, PromiseFilters } from "./api";

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

export const MOCK_DEPARTMENTS = [
  { value: "SANTAFE DE BOGOTA D.C", label: "Bogotá D.C.", geoName: "SANTAFE DE BOGOTA D.C", avgRisk: 0.72, contractCount: 312_840 },
  { value: "ANTIOQUIA", label: "Antioquia", geoName: "ANTIOQUIA", avgRisk: 0.65, contractCount: 198_420 },
  { value: "VALLE DEL CAUCA", label: "Valle del Cauca", geoName: "VALLE DEL CAUCA", avgRisk: 0.61, contractCount: 142_350 },
  { value: "ATLANTICO", label: "Atlántico", geoName: "ATLANTICO", avgRisk: 0.58, contractCount: 87_230 },
  { value: "SANTANDER", label: "Santander", geoName: "SANTANDER", avgRisk: 0.54, contractCount: 76_180 },
  { value: "BOLIVAR", label: "Bolívar", geoName: "BOLIVAR", avgRisk: 0.67, contractCount: 68_420 },
  { value: "CUNDINAMARCA", label: "Cundinamarca", geoName: "CUNDINAMARCA", avgRisk: 0.49, contractCount: 63_210 },
  { value: "CORDOBA", label: "Córdoba", geoName: "CORDOBA", avgRisk: 0.71, contractCount: 58_340 },
  { value: "NARINO", label: "Nariño", geoName: "NARINO", avgRisk: 0.52, contractCount: 52_180 },
  { value: "TOLIMA", label: "Tolima", geoName: "TOLIMA", avgRisk: 0.55, contractCount: 48_920 },
  { value: "META", label: "Meta", geoName: "META", avgRisk: 0.63, contractCount: 44_310 },
  { value: "HUILA", label: "Huila", geoName: "HUILA", avgRisk: 0.47, contractCount: 40_280 },
  { value: "CESAR", label: "Cesar", geoName: "CESAR", avgRisk: 0.68, contractCount: 38_640 },
  { value: "MAGDALENA", label: "Magdalena", geoName: "MAGDALENA", avgRisk: 0.66, contractCount: 36_780 },
  { value: "NORTE DE SANTANDER", label: "Norte de Santander", geoName: "NORTE DE SANTANDER", avgRisk: 0.61, contractCount: 34_520 },
  { value: "CAUCA", label: "Cauca", geoName: "CAUCA", avgRisk: 0.58, contractCount: 32_140 },
  { value: "BOYACA", label: "Boyacá", geoName: "BOYACA", avgRisk: 0.51, contractCount: 30_890 },
  { value: "CALDAS", label: "Caldas", geoName: "CALDAS", avgRisk: 0.44, contractCount: 28_670 },
  { value: "RISARALDA", label: "Risaralda", geoName: "RISARALDA", avgRisk: 0.46, contractCount: 26_340 },
  { value: "SUCRE", label: "Sucre", geoName: "SUCRE", avgRisk: 0.73, contractCount: 24_180 },
  { value: "QUINDIO", label: "Quindío", geoName: "QUINDIO", avgRisk: 0.48, contractCount: 22_180 },
  { value: "CHOCO", label: "Chocó", geoName: "CHOCO", avgRisk: 0.78, contractCount: 21_420 },
  { value: "CASANARE", label: "Casanare", geoName: "CASANARE", avgRisk: 0.62, contractCount: 18_930 },
  { value: "GUAJIRA", label: "La Guajira", geoName: "GUAJIRA", avgRisk: 0.81, contractCount: 17_640 },
  { value: "ARAUCA", label: "Arauca", geoName: "ARAUCA", avgRisk: 0.69, contractCount: 14_280 },
  { value: "CAQUETA", label: "Caquetá", geoName: "CAQUETA", avgRisk: 0.57, contractCount: 12_340 },
  { value: "PUTUMAYO", label: "Putumayo", geoName: "PUTUMAYO", avgRisk: 0.64, contractCount: 10_890 },
  { value: "SAN ANDRES", label: "San Andrés", geoName: "SAN ANDRES", avgRisk: 0.43, contractCount: 6_280 },
  { value: "VICHADA", label: "Vichada", geoName: "VICHADA", avgRisk: 0.71, contractCount: 4_230 },
  { value: "AMAZONAS", label: "Amazonas", geoName: "AMAZONAS", avgRisk: 0.53, contractCount: 3_840 },
  { value: "GUAINIA", label: "Guainía", geoName: "GUAINIA", avgRisk: 0.67, contractCount: 2_910 },
  { value: "VAUPES", label: "Vaupés", geoName: "VAUPES", avgRisk: 0.61, contractCount: 2_140 },
];

const MODALITIES = [
  { value: "Contratacion directa", label: "Contratación directa" },
  { value: "Seleccion abreviada", label: "Selección abreviada" },
  { value: "Licitacion publica", label: "Licitación pública" },
  { value: "Concurso de meritos", label: "Concurso de méritos" },
  { value: "Minima cuantia", label: "Mínima cuantía" },
  { value: "Regimen especial", label: "Régimen especial" },
];

// ─── LEAD CASES ──────────────────────────────────────────────────────────────

const LEAD_CASES: OverviewPayload["leadCases"] = [
  {
    id: "CO-2024-UNGRD-001",
    score: 87,
    riskBand: "high",
    entity: "UNIDAD NACIONAL PARA GESTIÓN DEL RIESGO DE DESASTRES",
    provider: "SOLUCIONES HIDRÁULICAS DEL CARIBE S.A.S.",
    department: "GUAJIRA",
    modality: "Contratación directa",
    date: "2024-08-14",
    value: 4_870_000_000,
    valueLabel: "$4.870M",
    secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-249782",
    pickReason: "caso guía · sobreprecio",
    signal: "Valor unitario 54 % sobre referencia de mercado + modalidad directa + ventana electoral",
    factors: [
      { key: "valor_unitario", label: "Valor vs. referencia de mercado", severity: 0.94 },
      { key: "modalidad", label: "Contratación directa sin proceso competitivo", severity: 0.88 },
      { key: "concentracion", label: "Alta concentración proveedor–entidad", severity: 0.76 },
      { key: "ventana_electoral", label: "Firmado en ventana preelectoral", severity: 0.68 },
      { key: "plazo", label: "Plazo de ejecución inusualmente corto", severity: 0.52 },
    ],
  },
  {
    id: "CO-2025-INVIAS-038",
    score: 82,
    riskBand: "high",
    entity: "INSTITUTO NACIONAL DE VÍAS — INVÍAS",
    provider: "CONSTRUCTORA VIAL DEL PACÍFICO S.A.",
    department: "CHOCO",
    modality: "Licitación pública",
    date: "2025-01-22",
    value: 18_340_000_000,
    valueLabel: "$18.340M",
    secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-049813",
    pickReason: "único oferente habilitado",
    signal: "Único proponente habilitado + adición del 48 % en < 30 días + departamento de alta señal",
    factors: [
      { key: "competencia", label: "Proceso con único proponente habilitado", severity: 0.91 },
      { key: "adicion", label: "Adición del 48 % dentro del primer mes", severity: 0.85 },
      { key: "departamento", label: "Departamento con alta señal histórica", severity: 0.72 },
      { key: "plazo_ejecucion", label: "Plazo total vs. obras similares", severity: 0.61 },
      { key: "valor_km", label: "Costo por km sobre percentil 90", severity: 0.58 },
    ],
  },
  {
    id: "CO-2025-MINSALUD-114",
    score: 76,
    riskBand: "high",
    entity: "MINISTERIO DE SALUD Y PROTECCIÓN SOCIAL",
    provider: "DISTRIBUIDORA MÉDICA ANDINA LTDA.",
    department: "SANTAFE DE BOGOTA D.C",
    modality: "Selección abreviada",
    date: "2025-02-07",
    value: 9_120_000_000,
    valueLabel: "$9.120M",
    secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-067241",
    pickReason: "proveedor recurrente",
    signal: "Cuarto contrato consecutivo mismo proveedor + precio unitario sobre referencia IPS pública",
    factors: [
      { key: "reincidencia", label: "Proveedor ganador consecutivo (4 contratos)", severity: 0.89 },
      { key: "precio_unitario", label: "Precio unitario sobre referencia IPS pública", severity: 0.82 },
      { key: "competencia", label: "Oferentes por debajo de la mediana sectorial", severity: 0.67 },
      { key: "monto_acumulado", label: "Monto acumulado entidad–proveedor atípico", severity: 0.59 },
      { key: "plazo", label: "Plazos homogéneos inusualmente cortos", severity: 0.43 },
    ],
  },
  {
    id: "CO-2025-ALCBOG-227",
    score: 68,
    riskBand: "medium",
    entity: "ALCALDÍA MAYOR DE BOGOTÁ D.C.",
    provider: "TECNOLOGÍAS URBANAS S.A.S.",
    department: "SANTAFE DE BOGOTA D.C",
    modality: "Selección abreviada",
    date: "2025-03-11",
    value: 6_850_000_000,
    valueLabel: "$6.850M",
    secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-089432",
    pickReason: "urgencia manifiesta atípica",
    signal: "Urgencia manifiesta fuera de patrón + monto sobre umbral de licitación + proveedor con experiencia mínima",
    factors: [
      { key: "urgencia_manifiesta", label: "Urgencia manifiesta fuera de patrón estacional", severity: 0.78 },
      { key: "monto_modalidad", label: "Monto supera umbral de licitación pública", severity: 0.71 },
      { key: "experiencia", label: "Proveedor con experiencia mínima registrada", severity: 0.64 },
      { key: "sector", label: "Sector tecnológico con alta varianza de precios", severity: 0.52 },
      { key: "plazo_entrega", label: "Plazo de entrega comprimido: 12 días", severity: 0.41 },
    ],
  },
  {
    id: "CO-2024-GOB-SUCRE-089",
    score: 65,
    riskBand: "medium",
    entity: "GOBERNACIÓN DE SUCRE",
    provider: "CONSTRUIR CARIBE SAS",
    department: "SUCRE",
    modality: "Contratación directa",
    date: "2024-11-05",
    value: 3_240_000_000,
    valueLabel: "$3.240M",
    secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-298761",
    pickReason: "ventana preelectoral",
    signal: "Firmado 18 días antes de restricción Ley de Garantías + proveedor recurrente + departamento de alta señal",
    factors: [
      { key: "ventana_electoral", label: "18 días antes de restricción Ley Garantías", severity: 0.88 },
      { key: "concentracion", label: "Proveedor recurrente con gobernación", severity: 0.75 },
      { key: "departamento", label: "Sucre históricamente sobre percentil 75", severity: 0.68 },
      { key: "monto", label: "Monto en rango de alta varianza modal", severity: 0.54 },
      { key: "rubro", label: "Rubro con contratación directa atípica", severity: 0.44 },
    ],
  },
];

// ─── TABLE ROWS ──────────────────────────────────────────────────────────────

const ALL_ROWS: OverviewPayload["leadCases"] = [
  ...LEAD_CASES,
  { id: "CO-2025-ANI-051", score: 79, riskBand: "high", entity: "AGENCIA NACIONAL DE INFRAESTRUCTURA", provider: "CONCESIONES VIALES S.A.S.", department: "ANTIOQUIA", modality: "Concurso de méritos", date: "2025-02-28", value: 24_600_000_000, valueLabel: "$24.600M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-055119", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-GDA-145", score: 83, riskBand: "high", entity: "GOBERNACIÓN DEL CHOCÓ", provider: "COMUNIDADES ASOCIADAS DEL ATRATO SAS", department: "CHOCO", modality: "Contratación directa", date: "2024-07-08", value: 2_930_000_000, valueLabel: "$2.930M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-241876", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-COR-GJR-078", score: 77, riskBand: "high", entity: "GOBERNACIÓN DE CÓRDOBA", provider: "INGENIERÍA TROPICAL S.A.", department: "CORDOBA", modality: "Selección abreviada", date: "2024-09-30", value: 4_120_000_000, valueLabel: "$4.120M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-271345", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-SAF-CESAR-199", score: 71, riskBand: "high", entity: "GOBERNACIÓN DEL CESAR", provider: "ALIANZA VIAL DEL CARIBE S.A.S.", department: "CESAR", modality: "Contratación directa", date: "2024-12-02", value: 3_780_000_000, valueLabel: "$3.780M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-311892", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-VIC-013", score: 74, riskBand: "high", entity: "GOBERNACIÓN DEL VICHADA", provider: "SERVICIOS RURALES INTEGRADOS LTDA.", department: "VICHADA", modality: "Contratación directa", date: "2025-01-17", value: 1_230_000_000, valueLabel: "$1.230M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-039841", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-COL-MAG-033", score: 66, riskBand: "medium", entity: "GOBERNACIÓN DEL MAGDALENA", provider: "OPERADORES INTEGRALES DEL NORTE S.A.", department: "MAGDALENA", modality: "Selección abreviada", date: "2025-01-09", value: 2_560_000_000, valueLabel: "$2.560M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-034218", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-SENA-302", score: 61, riskBand: "medium", entity: "SERVICIO NACIONAL DE APRENDIZAJE — SENA", provider: "SOLUCIONES EDUCATIVAS INTEGRALES S.A.", department: "ATLANTICO", modality: "Selección abreviada", date: "2024-09-18", value: 2_180_000_000, valueLabel: "$2.180M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-267834", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-ICBF-077", score: 58, riskBand: "medium", entity: "INSTITUTO COLOMBIANO DE BIENESTAR FAMILIAR", provider: "OPERADORES SOCIALES DEL PACÍFICO LTDA.", department: "VALLE DEL CAUCA", modality: "Contratación directa", date: "2025-01-30", value: 1_740_000_000, valueLabel: "$1.740M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-041272", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-NARC-067", score: 63, riskBand: "medium", entity: "GOBERNACIÓN DE NARIÑO", provider: "CONSTRUCTORA ANDINA DEL SUR S.A.S.", department: "NARINO", modality: "Licitación pública", date: "2024-11-12", value: 5_870_000_000, valueLabel: "$5.870M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-291234", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-BOL-112", score: 69, riskBand: "medium", entity: "GOBERNACIÓN DE BOLÍVAR", provider: "SERVICIOS PORTUARIOS DEL CARIBE SAS", department: "BOLIVAR", modality: "Selección abreviada", date: "2024-10-15", value: 3_120_000_000, valueLabel: "$3.120M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-275841", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-IDRD-190", score: 54, riskBand: "medium", entity: "INSTITUTO DISTRITAL DE RECREACIÓN Y DEPORTE", provider: "INGENIERÍA Y CONSTRUCCIÓN BOGOTÁ S.A.", department: "SANTAFE DE BOGOTA D.C", modality: "Licitación pública", date: "2024-10-22", value: 5_490_000_000, valueLabel: "$5.490M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-279123", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-DIAN-029", score: 52, riskBand: "medium", entity: "DIRECCIÓN DE IMPUESTOS Y ADUANAS NACIONALES", provider: "SOLUCIONES TI COLOMBIA S.A.S.", department: "SANTAFE DE BOGOTA D.C", modality: "Selección abreviada", date: "2025-03-05", value: 3_820_000_000, valueLabel: "$3.820M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-081945", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-MTRA-044", score: 48, riskBand: "low", entity: "MINISTERIO DE TRANSPORTE", provider: "INGENIERÍA Y ESTUDIOS VIALES S.A.", department: "CUNDINAMARCA", modality: "Concurso de méritos", date: "2025-02-25", value: 4_340_000_000, valueLabel: "$4.340M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-061934", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-ICLD-221", score: 44, riskBand: "low", entity: "ALCALDÍA DE MEDELLÍN", provider: "CONSORCIO METRO DIGITAL", department: "ANTIOQUIA", modality: "Licitación pública", date: "2025-02-14", value: 8_760_000_000, valueLabel: "$8.760M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-052877", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-UAESP-061", score: 45, riskBand: "low", entity: "UNIDAD ADMIN. ESPECIAL SERVICIOS PÚBLICOS", provider: "CONSORCIO ASEO BOGOTÁ", department: "SANTAFE DE BOGOTA D.C", modality: "Licitación pública", date: "2025-03-20", value: 31_200_000_000, valueLabel: "$31.200M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-095712", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-ARN-018", score: 42, riskBand: "low", entity: "ARMADA NACIONAL DE COLOMBIA", provider: "ASTILLEROS COLOMBIANOS S.A.", department: "BOLIVAR", modality: "Régimen especial", date: "2025-02-01", value: 7_890_000_000, valueLabel: "$7.890M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-044511", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-MINED-083", score: 38, riskBand: "low", entity: "MINISTERIO DE EDUCACIÓN NACIONAL", provider: "EDITORIAL EDUCATIVA NACIONAL S.A.S.", department: "SANTAFE DE BOGOTA D.C", modality: "Licitación pública", date: "2025-01-15", value: 12_400_000_000, valueLabel: "$12.400M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-038912", pickReason: "", signal: "", factors: [] },
  { id: "CO-2024-ACUEDUCTO-472", score: 35, riskBand: "low", entity: "EMPRESA DE ACUEDUCTO DE BOGOTÁ", provider: "CONSORCIO REDES BOGOTÁ 2024", department: "SANTAFE DE BOGOTA D.C", modality: "Licitación pública", date: "2024-08-28", value: 15_670_000_000, valueLabel: "$15.670M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=24-1-253178", pickReason: "", signal: "", factors: [] },
  { id: "CO-2025-ECOPETROL-021", score: 33, riskBand: "low", entity: "ECOPETROL S.A.", provider: "SERVICIOS TÉCNICOS PETROLEROS S.A.", department: "META", modality: "Régimen especial", date: "2025-01-28", value: 42_100_000_000, valueLabel: "$42.100M", secopUrl: "https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=25-1-043122", pickReason: "", signal: "", factors: [] },
];

// ─── POLITICIANS ─────────────────────────────────────────────────────────────

type PoliticianMock = {
  id: string;
  name: string;
  initials: string;
  role: string;
  party: string;
  partyColor: string;
  chamber: string;
  overallScore: number;
  statusCounts: { fulfilled: number; monitoring: number; noAction: number };
  domains: PromisesPayload["scorecard"]["domains"];
  cards: PromisesPayload["cards"];
};

const POLITICIANS: PoliticianMock[] = [
  {
    id: "gustavo-petro",
    name: "Gustavo Petro",
    initials: "GP",
    role: "Presidente de la República",
    party: "Colombia Humana · Pacto Histórico",
    partyColor: "#7b2d8b",
    chamber: "Ejecutivo",
    overallScore: 41,
    statusCounts: { fulfilled: 2, monitoring: 5, noAction: 4 },
    domains: [
      { key: "paz", label: "Paz total", score: 0.38, promises: 3 },
      { key: "salud", label: "Reforma en salud", score: 0.29, promises: 2 },
      { key: "ambiente", label: "Transición energética", score: 0.55, promises: 2 },
      { key: "economia", label: "Reforma pensional", score: 0.44, promises: 2 },
    ],
    cards: [
      { id: "gp-01", promiseId: "p-gp-01", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "paz", domainLabel: "Paz total", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 62, statusConfidence: 58, extractionConfidence: 91, promiseText: "Impulsar acuerdos de paz negociada con todas las organizaciones armadas ilegales bajo el marco de la Paz Total.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Instalación de mesa de diálogo con el ELN", actionSummary: "El Gobierno instaló formalmente la mesa de diálogo con el ELN en La Habana. Avances han sido parciales; hay ceses al fuego bilaterales suscritos aunque con interrupciones.", actionDate: "2023-11-21", actionSourceUrl: "https://www.cancilleria.gov.co/", actionSourceSystem: "Cancillería de Colombia" },
      { id: "gp-02", promiseId: "p-gp-02", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "salud", domainLabel: "Reforma en salud", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 48, statusConfidence: 44, extractionConfidence: 87, promiseText: "Transformar el sistema de salud hacia un modelo público, preventivo y con eliminación de las EPS intermediarias.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Proyecto de Ley de Reforma a la Salud", actionSummary: "El proyecto de reforma fue radicado en el Congreso. Pasó primer debate en Comisión Séptima del Senado, pero continúa con reparos jurídicos y está pendiente de aprobación final.", actionDate: "2024-06-10", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "gp-03", promiseId: "p-gp-03", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "ambiente", domainLabel: "Transición energética", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 78, statusConfidence: 72, extractionConfidence: 93, promiseText: "Iniciar la transición energética justa: reducir dependencia del petróleo y gas, e incrementar la participación de energías renovables en la matriz.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Ley de Transición Energética (Ley 2099 reglamentada)", actionSummary: "Se expidieron decretos reglamentarios de la transición energética y se adjudicaron contratos de energía renovable por más de 3.000 MW adicionales a la red nacional.", actionDate: "2024-03-15", actionSourceUrl: "https://www.minenergia.gov.co/", actionSourceSystem: "Ministerio de Minas y Energía" },
      { id: "gp-04", promiseId: "p-gp-04", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "economia", domainLabel: "Reforma pensional", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 74, statusConfidence: 69, extractionConfidence: 88, promiseText: "Aprobar la reforma pensional que garantice pensión a los adultos mayores que nunca cotizaron al sistema.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Reforma Pensional aprobada — Ley 2381 de 2024", actionSummary: "El Congreso aprobó la Reforma Pensional en junio de 2024, creando el sistema de pilares y ampliando la cobertura del sistema Colpensiones para adultos mayores no cotizantes.", actionDate: "2024-06-14", actionSourceUrl: "https://www.colpensiones.gov.co/", actionSourceSystem: "Ministerio del Trabajo / Colpensiones" },
      { id: "gp-05", promiseId: "p-gp-05", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "paz", domainLabel: "Paz total", status: "sin_accion_registrada", statusLabel: "Sin evidencia disponible", similarityScore: 28, statusConfidence: 31, extractionConfidence: 82, promiseText: "Implementar la Jurisdicción Especial para la Paz (JEP) de forma plena y garantizar los derechos de las víctimas del conflicto armado.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "—", actionSummary: "No se encontró evidencia registrada de nueva legislación o acción ejecutiva adicional específica a este compromiso en el período evaluado.", actionDate: "—", actionSourceUrl: "#", actionSourceSystem: "—" },
      { id: "gp-06", promiseId: "p-gp-06", politicianId: "gustavo-petro", politicianName: "Gustavo Petro", domain: "salud", domainLabel: "Reforma en salud", status: "sin_accion_registrada", statusLabel: "Sin evidencia disponible", similarityScore: 22, statusConfidence: 26, extractionConfidence: 79, promiseText: "Garantizar el acceso universal a medicamentos esenciales y prohibir la intermediación especulativa en el sistema.", promiseSourceUrl: "https://www.petro.com.co/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "—", actionSummary: "La evidencia registrada no muestra legislación específica aprobada sobre precios o acceso a medicamentos en el periodo evaluado.", actionDate: "—", actionSourceUrl: "#", actionSourceSystem: "—" },
    ],
  },
  {
    id: "francia-marquez",
    name: "Francia Márquez",
    initials: "FM",
    role: "Vicepresidenta de la República",
    party: "Soy Porque Somos · Pacto Histórico",
    partyColor: "#7b2d8b",
    chamber: "Ejecutivo",
    overallScore: 52,
    statusCounts: { fulfilled: 2, monitoring: 2, noAction: 1 },
    domains: [
      { key: "ambiente", label: "Justicia ambiental", score: 0.68, promises: 2 },
      { key: "derechos", label: "Comunidades étnicas", score: 0.54, promises: 2 },
      { key: "genero", label: "Equidad de género", score: 0.44, promises: 1 },
    ],
    cards: [
      { id: "fm-01", promiseId: "p-fm-01", politicianId: "francia-marquez", politicianName: "Francia Márquez", domain: "ambiente", domainLabel: "Justicia ambiental", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 81, statusConfidence: 76, extractionConfidence: 94, promiseText: "Detener la minería ilegal en territorios colectivos de comunidades afrodescendientes e indígenas del Pacífico.", promiseSourceUrl: "https://www.soyporquesomos.com/programa", promiseSourceLabel: "Programa de Campaña 2022", actionTitle: "Operaciones de erradicación minería ilegal Chocó-Cauca", actionSummary: "El Ministerio de Minas y la Fiscalía ejecutaron operaciones conjuntas contra la minería ilegal en Chocó y Cauca. Más de 120 retroexcavadoras destruidas en 2023-2024.", actionDate: "2024-01-18", actionSourceUrl: "https://www.minminas.gov.co/", actionSourceSystem: "Ministerio de Minas y Energía" },
      { id: "fm-02", promiseId: "p-fm-02", politicianId: "francia-marquez", politicianName: "Francia Márquez", domain: "derechos", domainLabel: "Comunidades étnicas", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 73, statusConfidence: 68, extractionConfidence: 89, promiseText: "Crear el Ministerio de la Igualdad como institución para las políticas de género, raza e inclusión.", promiseSourceUrl: "https://www.soyporquesomos.com/programa", promiseSourceLabel: "Programa de Campaña 2022", actionTitle: "Ley 2281 — creación Ministerio de Igualdad", actionSummary: "La Ley 2281 de 2023 creó el Ministerio de Igualdad y Equidad. Francia Márquez fue nombrada Ministra de esta cartera además de su rol como Vicepresidenta.", actionDate: "2023-02-14", actionSourceUrl: "https://www.minigualdad.gov.co/", actionSourceSystem: "Ministerio de Igualdad y Equidad" },
      { id: "fm-03", promiseId: "p-fm-03", politicianId: "francia-marquez", politicianName: "Francia Márquez", domain: "derechos", domainLabel: "Comunidades étnicas", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 55, statusConfidence: 50, extractionConfidence: 86, promiseText: "Garantizar la consulta previa libre e informada en todos los proyectos que afecten territorios colectivos.", promiseSourceUrl: "https://www.soyporquesomos.com/programa", promiseSourceLabel: "Programa de Campaña 2022", actionTitle: "Decreto reglamentario consulta previa 2023", actionSummary: "Se expidió un decreto que refuerza los protocolos de consulta previa, pero su implementación efectiva sigue siendo objeto de seguimiento por comunidades y organismos de derechos humanos.", actionDate: "2023-08-22", actionSourceUrl: "https://www.mininterior.gov.co/", actionSourceSystem: "Ministerio del Interior" },
      { id: "fm-04", promiseId: "p-fm-04", politicianId: "francia-marquez", politicianName: "Francia Márquez", domain: "genero", domainLabel: "Equidad de género", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 49, statusConfidence: 45, extractionConfidence: 83, promiseText: "Implementar una política pública integral de erradicación de la violencia de género con presupuesto dedicado.", promiseSourceUrl: "https://www.soyporquesomos.com/programa", promiseSourceLabel: "Programa de Campaña 2022", actionTitle: "Plan Nacional de Igualdad 2023-2026", actionSummary: "El Ministerio de Igualdad publicó el Plan Nacional de Igualdad, pero organizaciones de mujeres señalan que los presupuestos asignados son insuficientes para su ejecución efectiva.", actionDate: "2023-11-08", actionSourceUrl: "https://www.minigualdad.gov.co/", actionSourceSystem: "Ministerio de Igualdad y Equidad" },
      { id: "fm-05", promiseId: "p-fm-05", politicianId: "francia-marquez", politicianName: "Francia Márquez", domain: "ambiente", domainLabel: "Justicia ambiental", status: "sin_accion_registrada", statusLabel: "Sin evidencia disponible", similarityScore: 31, statusConfidence: 34, extractionConfidence: 80, promiseText: "Crear un fondo especial para la reparación colectiva de comunidades afrodescendientes víctimas del conflicto y la minería ilegal.", promiseSourceUrl: "https://www.soyporquesomos.com/programa", promiseSourceLabel: "Programa de Campaña 2022", actionTitle: "—", actionSummary: "No se encontró legislación específica o decreto que haya creado un fondo dedicado para reparación colectiva afrodescendiente en el período evaluado.", actionDate: "—", actionSourceUrl: "#", actionSourceSystem: "—" },
    ],
  },
  {
    id: "maria-jose-pizarro",
    name: "María José Pizarro",
    initials: "MJP",
    role: "Senadora de la República",
    party: "Colombia Humana · Pacto Histórico",
    partyColor: "#7b2d8b",
    chamber: "Senado",
    overallScore: 47,
    statusCounts: { fulfilled: 1, monitoring: 3, noAction: 2 },
    domains: [
      { key: "paz", label: "Paz y reconciliación", score: 0.58, promises: 2 },
      { key: "justicia", label: "Reforma carcelaria", score: 0.42, promises: 2 },
      { key: "juventud", label: "Política de juventudes", score: 0.34, promises: 2 },
    ],
    cards: [
      { id: "mjp-01", promiseId: "p-mjp-01", politicianId: "maria-jose-pizarro", politicianName: "María José Pizarro", domain: "paz", domainLabel: "Paz y reconciliación", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 67, statusConfidence: 62, extractionConfidence: 88, promiseText: "Impulsar desde el Senado la aprobación de un estatuto de garantías para la paz negociada con el ELN.", promiseSourceUrl: "https://www.senadopizarro.co/", promiseSourceLabel: "Declaración programática 2022", actionTitle: "Debate de control político proceso de paz con ELN", actionSummary: "Pizarro ha liderado debates de control político sobre el proceso de paz, solicitando informes periódicos al Gobierno sobre la mesa de diálogo. Sin legislación aprobada aún.", actionDate: "2024-04-09", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "mjp-02", promiseId: "p-mjp-02", politicianId: "maria-jose-pizarro", politicianName: "María José Pizarro", domain: "justicia", domainLabel: "Reforma carcelaria", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 72, statusConfidence: 67, extractionConfidence: 91, promiseText: "Reformar el sistema penitenciario para reducir el hacinamiento y garantizar condiciones dignas de reclusión.", promiseSourceUrl: "https://www.senadopizarro.co/", promiseSourceLabel: "Declaración programática 2022", actionTitle: "Proyecto de Ley reforma sistema penitenciario — aprobado primer debate", actionSummary: "El proyecto que reforma el INPEC y crea medidas alternativas a la pena privativa de libertad pasó primer debate en Senado con ponencia de Pizarro. Continúa trámite legislativo.", actionDate: "2024-09-17", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "mjp-03", promiseId: "p-mjp-03", politicianId: "maria-jose-pizarro", politicianName: "María José Pizarro", domain: "juventud", domainLabel: "Política de juventudes", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 44, statusConfidence: 41, extractionConfidence: 82, promiseText: "Ampliar el acceso a educación superior gratuita para jóvenes de estratos 1, 2 y 3 a través de reformas al sistema de financiación.", promiseSourceUrl: "https://www.senadopizarro.co/", promiseSourceLabel: "Declaración programática 2022", actionTitle: "Proyecto de Ley gratuidad educación superior en estudio", actionSummary: "Se radicó un proyecto de reforma a la financiación de educación superior que está en estudio en Comisión Sexta. No ha sido aprobado en ningún debate.", actionDate: "2024-02-28", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
    ],
  },
  {
    id: "paloma-valencia",
    name: "Paloma Valencia",
    initials: "PV",
    role: "Senadora de la República",
    party: "Centro Democrático",
    partyColor: "#e0621a",
    chamber: "Senado",
    overallScore: 36,
    statusCounts: { fulfilled: 1, monitoring: 2, noAction: 3 },
    domains: [
      { key: "seguridad", label: "Seguridad ciudadana", score: 0.51, promises: 2 },
      { key: "economia", label: "Estabilidad económica", score: 0.38, promises: 2 },
      { key: "educacion", label: "Libertad educativa", score: 0.24, promises: 2 },
    ],
    cards: [
      { id: "pv-01", promiseId: "p-pv-01", politicianId: "paloma-valencia", politicianName: "Paloma Valencia", domain: "seguridad", domainLabel: "Seguridad ciudadana", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 58, statusConfidence: 53, extractionConfidence: 86, promiseText: "Impulsar el fortalecimiento de la Fuerza Pública y oponerse a cualquier reforma que limite sus capacidades operativas.", promiseSourceUrl: "https://www.centrodemocratico.com/", promiseSourceLabel: "Posición programática CD 2022", actionTitle: "Control político Política de Seguridad del Gobierno", actionSummary: "Valencia ha liderado debates de control político cuestionando la política de Paz Total y la reducción de operaciones militares. Sin legislación aprobada en este sentido.", actionDate: "2024-03-12", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "pv-02", promiseId: "p-pv-02", politicianId: "paloma-valencia", politicianName: "Paloma Valencia", domain: "economia", domainLabel: "Estabilidad económica", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 64, statusConfidence: 59, extractionConfidence: 87, promiseText: "Oponerse a reformas tributarias que eleven la carga impositiva sobre las empresas y frenen la inversión privada.", promiseSourceUrl: "https://www.centrodemocratico.com/", promiseSourceLabel: "Posición programática CD 2022", actionTitle: "Voto en contra y debate Reforma Tributaria 2022", actionSummary: "Valencia votó en contra de la Reforma Tributaria de 2022 (Ley 2277) y presentó pliego de modificaciones durante el trámite. Su posición quedó documentada en los anales del Congreso.", actionDate: "2022-11-03", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "pv-03", promiseId: "p-pv-03", politicianId: "paloma-valencia", politicianName: "Paloma Valencia", domain: "educacion", domainLabel: "Libertad educativa", status: "sin_accion_registrada", statusLabel: "Sin evidencia disponible", similarityScore: 29, statusConfidence: 32, extractionConfidence: 78, promiseText: "Proteger la libertad de cátedra y oponerse a la ideologización de los currículos educativos públicos.", promiseSourceUrl: "https://www.centrodemocratico.com/", promiseSourceLabel: "Posición programática CD 2022", actionTitle: "—", actionSummary: "No se encontró proyecto de ley radicado ni debate específico de control político documentado sobre este compromiso.", actionDate: "—", actionSourceUrl: "#", actionSourceSystem: "—" },
    ],
  },
  {
    id: "katherine-miranda",
    name: "Katherine Miranda",
    initials: "KM",
    role: "Representante a la Cámara",
    party: "Alianza Verde",
    partyColor: "#2e8b57",
    chamber: "Cámara de Representantes",
    overallScore: 58,
    statusCounts: { fulfilled: 2, monitoring: 2, noAction: 1 },
    domains: [
      { key: "anticorrupcion", label: "Lucha anticorrupción", score: 0.72, promises: 2 },
      { key: "ambiente", label: "Política ambiental", score: 0.58, promises: 2 },
      { key: "participacion", label: "Participación ciudadana", score: 0.44, promises: 1 },
    ],
    cards: [
      { id: "km-01", promiseId: "p-km-01", politicianId: "katherine-miranda", politicianName: "Katherine Miranda", domain: "anticorrupcion", domainLabel: "Lucha anticorrupción", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 84, statusConfidence: 79, extractionConfidence: 95, promiseText: "Presentar proyectos de ley que amplíen las herramientas de rendición de cuentas y acceso a información pública sobre contratos del Estado.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Programa Alianza Verde 2022", actionTitle: "Proyecto de Ley transparencia SECOP aprobado — primer debate", actionSummary: "Miranda radicó y ponencio el proyecto de ley que obliga a publicar trazabilidad de contratistas en SECOP. Aprobado en primer debate en Comisión Primera con apoyo transversal.", actionDate: "2024-08-21", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "km-02", promiseId: "p-km-02", politicianId: "katherine-miranda", politicianName: "Katherine Miranda", domain: "anticorrupcion", domainLabel: "Lucha anticorrupción", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 76, statusConfidence: 71, extractionConfidence: 90, promiseText: "Impulsar audiencias y debates de control político en contratación pública con foco en departamentos de alta vulnerabilidad.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Programa Alianza Verde 2022", actionTitle: "Debate control político UNGRD — contratación La Guajira", actionSummary: "Miranda convocó debate de control político al UNGRD en el que se analizó el patrón de contratación directa en La Guajira. Resultó en solicitud de investigación a la Contraloría.", actionDate: "2024-10-14", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "km-03", promiseId: "p-km-03", politicianId: "katherine-miranda", politicianName: "Katherine Miranda", domain: "ambiente", domainLabel: "Política ambiental", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 61, statusConfidence: 56, extractionConfidence: 88, promiseText: "Prohibir el uso de plásticos de un solo uso en entidades del Estado y promover la economía circular en compras públicas.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Programa Alianza Verde 2022", actionTitle: "Proyecto de Ley compras públicas sostenibles en trámite", actionSummary: "Se radicó proyecto de ley que establece criterios ambientales en la contratación pública. Está en estudio en Comisión Tercera. No ha pasado debates.", actionDate: "2024-04-09", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
    ],
  },
  {
    id: "inti-asprilla",
    name: "Inti Asprilla",
    initials: "IA",
    role: "Representante a la Cámara",
    party: "Colombia Humana · Pacto Histórico",
    partyColor: "#7b2d8b",
    chamber: "Cámara de Representantes",
    overallScore: 43,
    statusCounts: { fulfilled: 1, monitoring: 3, noAction: 2 },
    domains: [
      { key: "educacion", label: "Educación pública", score: 0.52, promises: 2 },
      { key: "economia", label: "Reforma tributaria progresiva", score: 0.46, promises: 2 },
      { key: "derechos", label: "Derechos colectivos", score: 0.33, promises: 2 },
    ],
    cards: [
      { id: "ia-01", promiseId: "p-ia-01", politicianId: "inti-asprilla", politicianName: "Inti Asprilla", domain: "educacion", domainLabel: "Educación pública", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 69, statusConfidence: 64, extractionConfidence: 87, promiseText: "Incrementar el presupuesto para educación superior pública y garantizar la gratuidad en universidades oficiales para estratos 1 y 2.", promiseSourceUrl: "https://www.colombiahumana.com/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Incremento presupuesto MEN universidades 2023-2024", actionSummary: "El presupuesto del Ministerio de Educación Nacional incluyó un aumento del 14% para universidades públicas en 2024, equivalente a $620.000 millones adicionales.", actionDate: "2023-12-20", actionSourceUrl: "https://www.mineducacion.gov.co/", actionSourceSystem: "Ministerio de Educación Nacional" },
      { id: "ia-02", promiseId: "p-ia-02", politicianId: "inti-asprilla", politicianName: "Inti Asprilla", domain: "economia", domainLabel: "Reforma tributaria progresiva", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 53, statusConfidence: 49, extractionConfidence: 84, promiseText: "Apoyar y profundizar la reforma tributaria para que los grandes patrimonios y las empresas extractivas paguen más impuestos.", promiseSourceUrl: "https://www.colombiahumana.com/programa", promiseSourceLabel: "Programa de Gobierno 2022", actionTitle: "Voto a favor Reforma Tributaria Ley 2277 de 2022", actionSummary: "Asprilla votó a favor de la Reforma Tributaria y participó en la ponencia. La reforma incrementó impuestos a rentas superiores y al sector petrolero.", actionDate: "2022-11-03", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
    ],
  },
  {
    id: "david-luna",
    name: "David Luna",
    initials: "DL",
    role: "Senador de la República",
    party: "Cambio Radical",
    partyColor: "#1e5da6",
    chamber: "Senado",
    overallScore: 39,
    statusCounts: { fulfilled: 1, monitoring: 2, noAction: 3 },
    domains: [
      { key: "seguridad", label: "Seguridad pública", score: 0.48, promises: 2 },
      { key: "economia", label: "Crecimiento económico", score: 0.36, promises: 2 },
      { key: "infraestructura", label: "Infraestructura y conectividad", score: 0.33, promises: 2 },
    ],
    cards: [
      { id: "dl-01", promiseId: "p-dl-01", politicianId: "david-luna", politicianName: "David Luna", domain: "seguridad", domainLabel: "Seguridad pública", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 55, statusConfidence: 50, extractionConfidence: 83, promiseText: "Fortalecer las capacidades tecnológicas de la Policía Nacional para mejorar tiempos de respuesta en emergencias ciudadanas.", promiseSourceUrl: "https://www.cambioradical.com.co/", promiseSourceLabel: "Posición programática CR 2022", actionTitle: "Debate control político modernización tecnológica Policía", actionSummary: "Luna convocó debate de control político sobre el plan de modernización tecnológica de la Policía Nacional. No resultó en legislación aprobada.", actionDate: "2024-05-07", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "dl-02", promiseId: "p-dl-02", politicianId: "david-luna", politicianName: "David Luna", domain: "economia", domainLabel: "Crecimiento económico", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 66, statusConfidence: 61, extractionConfidence: 86, promiseText: "Impulsar legislación que mejore el ambiente de negocios y reduzca la burocracia para la creación de empresas.", promiseSourceUrl: "https://www.cambioradical.com.co/", promiseSourceLabel: "Posición programática CR 2022", actionTitle: "Ley Anti-Trámites aprobada — Cámara y Senado", actionSummary: "Con ponencia parcial de Luna, se aprobó la Ley Anti-Trámites que simplifica 51 procedimientos administrativos para empresas. Promulgada en 2023.", actionDate: "2023-07-19", actionSourceUrl: "https://www.mincomercio.gov.co/", actionSourceSystem: "Ministerio de Comercio" },
    ],
  },
  {
    id: "rodrigo-lara",
    name: "Rodrigo Lara Restrepo",
    initials: "RL",
    role: "Senador de la República",
    party: "Partido Liberal Colombiano",
    partyColor: "#cc0000",
    chamber: "Senado",
    overallScore: 44,
    statusCounts: { fulfilled: 2, monitoring: 2, noAction: 2 },
    domains: [
      { key: "anticorrupcion", label: "Anticorrupción", score: 0.61, promises: 2 },
      { key: "justicia", label: "Justicia eficiente", score: 0.44, promises: 2 },
      { key: "seguridad", label: "Seguridad ciudadana", score: 0.38, promises: 2 },
    ],
    cards: [
      { id: "rl-01", promiseId: "p-rl-01", politicianId: "rodrigo-lara", politicianName: "Rodrigo Lara Restrepo", domain: "anticorrupcion", domainLabel: "Anticorrupción", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 77, statusConfidence: 72, extractionConfidence: 92, promiseText: "Presentar legislación para fortalecer la Contraloría General y la Procuraduría en su capacidad sancionatoria frente a funcionarios corruptos.", promiseSourceUrl: "https://www.partidoliberal.org.co/", promiseSourceLabel: "Posición programática PLC 2022", actionTitle: "Proyecto de Ley fortalecimiento Contraloría — radicado", actionSummary: "Lara presentó el proyecto de ley que amplía las facultades de la Contraloría General para acceso a información bancaria de contratistas. Está en trámite en Comisión Primera.", actionDate: "2024-07-02", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "rl-02", promiseId: "p-rl-02", politicianId: "rodrigo-lara", politicianName: "Rodrigo Lara Restrepo", domain: "justicia", domainLabel: "Justicia eficiente", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 71, statusConfidence: 66, extractionConfidence: 88, promiseText: "Apoyar mecanismos de resolución alternativa de conflictos para descongestionar la rama judicial.", promiseSourceUrl: "https://www.partidoliberal.org.co/", promiseSourceLabel: "Posición programática PLC 2022", actionTitle: "Ley de conciliación extrajudicial en familia — aprobada", actionSummary: "Se aprobó con ponencia de Lara la ley que amplía los mecanismos de conciliación en materia de familia y menor cuantía civil, reduciendo carga judicial.", actionDate: "2023-09-12", actionSourceUrl: "https://www.minjusticia.gov.co/", actionSourceSystem: "Ministerio de Justicia" },
      { id: "rl-03", promiseId: "p-rl-03", politicianId: "rodrigo-lara", politicianName: "Rodrigo Lara Restrepo", domain: "seguridad", domainLabel: "Seguridad ciudadana", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 47, statusConfidence: 43, extractionConfidence: 82, promiseText: "Impulsar una política de reinserción laboral para personas que cumplen penas alternativas para reducir reincidencia.", promiseSourceUrl: "https://www.partidoliberal.org.co/", promiseSourceLabel: "Posición programática PLC 2022", actionTitle: "Proyecto de Ley reinserción laboral ex-reclusos en comisión", actionSummary: "El proyecto de política de reinserción laboral está en estudio en Comisión Sexta. Ha tenido audiencias públicas pero no ha avanzado en debates formales.", actionDate: "2024-06-18", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
    ],
  },
  {
    id: "angelica-lozano",
    name: "Angélica Lozano",
    initials: "AL",
    role: "Senadora de la República",
    party: "Alianza Verde",
    partyColor: "#1fbf75",
    chamber: "Senado",
    overallScore: 55,
    statusCounts: { fulfilled: 2, monitoring: 2, noAction: 1 },
    domains: [
      { key: "anticorrupcion", label: "Integridad pública", score: 0.66, promises: 2 },
      { key: "social", label: "Sistema de cuidado", score: 0.58, promises: 2 },
      { key: "ambiente", label: "Agenda climática", score: 0.43, promises: 1 },
    ],
    cards: [
      { id: "al-01", promiseId: "p-al-01", politicianId: "angelica-lozano", politicianName: "Angélica Lozano", domain: "anticorrupcion", domainLabel: "Integridad pública", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 79, statusConfidence: 73, extractionConfidence: 93, promiseText: "Fortalecer reglas de transparencia y trazabilidad sobre contratación, conflictos de interés y publicidad de ponencias.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Agenda legislativa 2022", actionTitle: "Ponencia y control político sobre trazabilidad contractual", actionSummary: "Lozano acompañó iniciativas y debates centrados en conflicto de interés, publicidad de información y control de contratación en entidades nacionales.", actionDate: "2024-08-28", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "al-02", promiseId: "p-al-02", politicianId: "angelica-lozano", politicianName: "Angélica Lozano", domain: "social", domainLabel: "Sistema de cuidado", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 72, statusConfidence: 67, extractionConfidence: 90, promiseText: "Impulsar una política nacional de cuidado con recursos visibles y corresponsabilidad institucional.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Agenda legislativa 2022", actionTitle: "Debates y articulación del sistema nacional de cuidado", actionSummary: "La agenda pública de Lozano en Senado ha incluido respaldo visible a normas y seguimiento sobre implementación del sistema de cuidado.", actionDate: "2024-05-16", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "al-03", promiseId: "p-al-03", politicianId: "angelica-lozano", politicianName: "Angélica Lozano", domain: "ambiente", domainLabel: "Agenda climática", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 51, statusConfidence: 47, extractionConfidence: 85, promiseText: "Exigir metas climáticas medibles y compras públicas más sostenibles en entidades nacionales.", promiseSourceUrl: "https://www.alianzaverde.org.co/", promiseSourceLabel: "Agenda legislativa 2022", actionTitle: "Seguimiento legislativo a compras sostenibles", actionSummary: "Se registran intervenciones y control político sobre metas ambientales, pero sin un cierre legislativo completo vinculado al compromiso.", actionDate: "2024-03-19", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
    ],
  },
  {
    id: "jota-pe-hernandez",
    name: "Jota Pe Hernández",
    initials: "JH",
    role: "Senador de la República",
    party: "Alianza Verde",
    partyColor: "#1fbf75",
    chamber: "Senado",
    overallScore: 41,
    statusCounts: { fulfilled: 1, monitoring: 3, noAction: 1 },
    domains: [
      { key: "anticorrupcion", label: "Control del gasto", score: 0.62, promises: 2 },
      { key: "salud", label: "Fiscalización en salud", score: 0.49, promises: 2 },
      { key: "seguridad", label: "Seguridad urbana", score: 0.36, promises: 1 },
    ],
    cards: [
      { id: "jh-01", promiseId: "p-jh-01", politicianId: "jota-pe-hernandez", politicianName: "Jota Pe Hernández", domain: "anticorrupcion", domainLabel: "Control del gasto", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 74, statusConfidence: 69, extractionConfidence: 91, promiseText: "Mantener vigilancia pública sobre contratación y uso del presupuesto con debates de alto impacto mediático.", promiseSourceUrl: "https://www.senado.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Debates públicos sobre gasto y contratación", actionSummary: "La actividad visible del senador se ha concentrado en denuncias, debates y seguimiento público a casos de gasto cuestionado.", actionDate: "2024-10-02", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "jh-02", promiseId: "p-jh-02", politicianId: "jota-pe-hernandez", politicianName: "Jota Pe Hernández", domain: "salud", domainLabel: "Fiscalización en salud", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 57, statusConfidence: 52, extractionConfidence: 86, promiseText: "Hacer control político permanente a EPS, hospitales y recursos públicos de salud.", promiseSourceUrl: "https://www.senado.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Control político sobre red hospitalaria y EPS", actionSummary: "Se registran debates e intervenciones sobre crisis hospitalaria y manejo de recursos, con evidencia de seguimiento pero no de resultado normativo pleno.", actionDate: "2024-06-04", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
      { id: "jh-03", promiseId: "p-jh-03", politicianId: "jota-pe-hernandez", politicianName: "Jota Pe Hernández", domain: "seguridad", domainLabel: "Seguridad urbana", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 42, statusConfidence: 38, extractionConfidence: 82, promiseText: "Pedir respuestas más rápidas frente a hurto, microtráfico y violencia en ciudades intermedias.", promiseSourceUrl: "https://www.senado.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Intervenciones sobre seguridad ciudadana", actionSummary: "Hay evidencia de posicionamiento público y debate, pero no de una pieza legislativa cerrada asociada directamente a este compromiso.", actionDate: "2024-04-17", actionSourceUrl: "https://www.senado.gov.co/", actionSourceSystem: "Senado de la República" },
    ],
  },
  {
    id: "cathy-juvinao",
    name: "Cathy Juvinao",
    initials: "CJ",
    role: "Representante a la Cámara",
    party: "Alianza Verde",
    partyColor: "#1fbf75",
    chamber: "Cámara de Representantes",
    overallScore: 52,
    statusCounts: { fulfilled: 2, monitoring: 2, noAction: 1 },
    domains: [
      { key: "salud", label: "Reforma a la salud", score: 0.63, promises: 2 },
      { key: "anticorrupcion", label: "Rendición de cuentas", score: 0.54, promises: 2 },
      { key: "educacion", label: "Educación pública", score: 0.41, promises: 1 },
    ],
    cards: [
      { id: "cj-01", promiseId: "p-cj-01", politicianId: "cathy-juvinao", politicianName: "Cathy Juvinao", domain: "salud", domainLabel: "Reforma a la salud", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 77, statusConfidence: 71, extractionConfidence: 92, promiseText: "Exigir una reforma a la salud con datos abiertos, control legislativo y métricas visibles de implementación.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Debates y proposiciones sobre reforma a la salud", actionSummary: "Juvinao ha tenido participación visible en debates, proposiciones y trazabilidad pública del trámite de la reforma a la salud.", actionDate: "2024-04-03", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "cj-02", promiseId: "p-cj-02", politicianId: "cathy-juvinao", politicianName: "Cathy Juvinao", domain: "anticorrupcion", domainLabel: "Rendición de cuentas", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 71, statusConfidence: 66, extractionConfidence: 89, promiseText: "Impulsar estándares más claros de rendición de cuentas sobre ejecución, contratación y gasto sectorial.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Control político y divulgación de ejecución sectorial", actionSummary: "La actividad pública registrada muestra presión sostenida para publicar datos de ejecución y hacer visibles cuellos de botella institucionales.", actionDate: "2024-09-10", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "cj-03", promiseId: "p-cj-03", politicianId: "cathy-juvinao", politicianName: "Cathy Juvinao", domain: "educacion", domainLabel: "Educación pública", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 46, statusConfidence: 41, extractionConfidence: 83, promiseText: "Proteger la calidad y permanencia estudiantil en educación superior pública con seguimiento al presupuesto.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Debate sobre financiación y permanencia universitaria", actionSummary: "Hay control político y seguimiento presupuestal documentado, pero sin una acción cerrada equivalente al compromiso completo.", actionDate: "2024-02-20", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
    ],
  },
  {
    id: "andres-forero",
    name: "Andrés Forero",
    initials: "AF",
    role: "Representante a la Cámara",
    party: "Centro Democrático",
    partyColor: "#ef7f1a",
    chamber: "Cámara de Representantes",
    overallScore: 38,
    statusCounts: { fulfilled: 1, monitoring: 2, noAction: 2 },
    domains: [
      { key: "educacion", label: "Calidad educativa", score: 0.51, promises: 2 },
      { key: "economia", label: "Disciplina fiscal", score: 0.42, promises: 2 },
      { key: "salud", label: "Control sectorial", score: 0.31, promises: 1 },
    ],
    cards: [
      { id: "af-01", promiseId: "p-af-01", politicianId: "andres-forero", politicianName: "Andrés Forero", domain: "educacion", domainLabel: "Calidad educativa", status: "en_seguimiento", statusLabel: "En seguimiento", similarityScore: 58, statusConfidence: 54, extractionConfidence: 87, promiseText: "Defender mediciones de calidad, mérito docente y evaluación pública del sistema educativo.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Control político sobre resultados y gestión educativa", actionSummary: "El representante ha sostenido debates e intervenciones sobre calidad educativa y gestión del sector, con evidencia parcial respecto del compromiso original.", actionDate: "2024-03-12", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "af-02", promiseId: "p-af-02", politicianId: "andres-forero", politicianName: "Andrés Forero", domain: "economia", domainLabel: "Disciplina fiscal", status: "con_accion_registrada", statusLabel: "Con acción registrada", similarityScore: 65, statusConfidence: 60, extractionConfidence: 88, promiseText: "Hacer oposición a expansiones fiscales sin respaldo técnico y exigir trazabilidad en el gasto social.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "Intervenciones y votos de oposición en debates fiscales", actionSummary: "Se documentan votos, posiciones y debates donde Forero ha cuestionado consistencia fiscal y ejecución de gasto del gobierno.", actionDate: "2024-06-18", actionSourceUrl: "https://www.camara.gov.co/", actionSourceSystem: "Cámara de Representantes" },
      { id: "af-03", promiseId: "p-af-03", politicianId: "andres-forero", politicianName: "Andrés Forero", domain: "salud", domainLabel: "Control sectorial", status: "sin_accion_registrada", statusLabel: "Sin evidencia disponible", similarityScore: 28, statusConfidence: 33, extractionConfidence: 80, promiseText: "Plantear una ruta alternativa de reforma a la salud con métricas de desempeño y garantías de continuidad.", promiseSourceUrl: "https://www.camara.gov.co/", promiseSourceLabel: "Perfil legislativo 2022", actionTitle: "—", actionSummary: "La evidencia visible en esta corrida no alcanza para enlazar una acción específica y suficientemente cercana a este compromiso.", actionDate: "—", actionSourceUrl: "#", actionSourceSystem: "—" },
    ],
  },
];

const PROMISE_STATUS_LABELS = {
  con_accion_registrada: "Con acción registrada",
  en_seguimiento: "En seguimiento",
  sin_accion_registrada: "Sin evidencia disponible",
} as const;

const PROMISE_EXPANSIONS = [
  {
    suffix: "trace",
    similarityDelta: -6,
    statusConfidenceDelta: -5,
    extractionConfidenceDelta: -3,
    promiseBuilder: (card: PromisesPayload["cards"][number]) =>
      `Publicar trazabilidad, hitos y responsables para ${card.domainLabel.toLowerCase()} con seguimiento periódico verificable.`,
    actionTitleBuilder: (card: PromisesPayload["cards"][number]) =>
      `Tablero de seguimiento para ${card.domainLabel.toLowerCase()}`,
    actionSummaryBuilder: (card: PromisesPayload["cards"][number]) =>
      `La evidencia visible muestra pasos de seguimiento, tableros, debates o documentos de control asociados a ${card.domainLabel.toLowerCase()}, aunque todavía sin cerrar todo el compromiso original.`,
    nextStatus: {
      con_accion_registrada: "en_seguimiento",
      en_seguimiento: "en_seguimiento",
      sin_accion_registrada: "sin_accion_registrada",
    } as const,
  },
  {
    suffix: "deployment",
    similarityDelta: -12,
    statusConfidenceDelta: -8,
    extractionConfidenceDelta: -4,
    promiseBuilder: (card: PromisesPayload["cards"][number]) =>
      `Llevar ${card.domainLabel.toLowerCase()} a implementación territorial, cronograma y presupuesto público con corte anual.`,
    actionTitleBuilder: (card: PromisesPayload["cards"][number]) =>
      `Ruta de implementación territorial para ${card.domainLabel.toLowerCase()}`,
    actionSummaryBuilder: (card: PromisesPayload["cards"][number]) =>
      `Se observa una ruta parcial de implementación, audiencias o anuncios con relación temática a ${card.domainLabel.toLowerCase()}, pero la cobertura sigue siendo incompleta frente a la promesa amplia.`,
    nextStatus: {
      con_accion_registrada: "en_seguimiento",
      en_seguimiento: "sin_accion_registrada",
      sin_accion_registrada: "en_seguimiento",
    } as const,
  },
];

function clampPercent(value: number) {
  return Math.max(12, Math.min(96, Math.round(value)));
}

function chamberKeyFromLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("cámara") || normalized.includes("camara") || normalized.includes("representante")) return "house";
  if (normalized.includes("senado") || normalized.includes("senador")) return "senate";
  return "executive";
}

function chamberMatches(chamber: string, filter?: string) {
  if (!filter || filter === "all") return true;
  return chamberKeyFromLabel(chamber) === filter;
}

function shiftedDate(raw: string, offsetDays: number) {
  if (!raw || raw === "—") return raw;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function expandPromiseCards(cards: PromisesPayload["cards"]) {
  return cards.flatMap((card, index) => {
    const expanded = [card];
    PROMISE_EXPANSIONS.forEach((variant, variantIndex) => {
      const nextStatus = variant.nextStatus[card.status];
      const similarity = clampPercent(card.similarityScore + variant.similarityDelta + (index % 4));
      const statusConfidence = clampPercent(card.statusConfidence + variant.statusConfidenceDelta + (index % 3));
      const extractionConfidence = clampPercent(card.extractionConfidence + variant.extractionConfidenceDelta);
      expanded.push({
        ...card,
        id: `${card.id}-${variant.suffix}`,
        promiseId: `${card.promiseId}-${variant.suffix}`,
        status: nextStatus,
        statusLabel: PROMISE_STATUS_LABELS[nextStatus],
        similarityScore: similarity,
        statusConfidence,
        extractionConfidence,
        promiseText: variant.promiseBuilder(card),
        actionTitle:
          nextStatus === "sin_accion_registrada"
            ? "Sin evidencia enlazada"
            : variant.actionTitleBuilder(card),
        actionSummary:
          nextStatus === "sin_accion_registrada"
            ? "La cobertura visible todavía no encuentra una acción pública suficientemente cercana para sostener este subcompromiso."
            : variant.actionSummaryBuilder(card),
        actionDate:
          nextStatus === "sin_accion_registrada"
            ? "—"
            : shiftedDate(card.actionDate, 28 * (variantIndex + 1)),
      });
    });
    return expanded;
  });
}

function buildStatusCounts(cards: PromisesPayload["cards"]) {
  return {
    fulfilled: cards.filter((card) => card.status === "con_accion_registrada").length,
    monitoring: cards.filter((card) => card.status === "en_seguimiento").length,
    noAction: cards.filter((card) => card.status === "sin_accion_registrada").length,
  };
}

function buildDomainScores(cards: PromisesPayload["cards"]) {
  const buckets = new Map<string, { label: string; promises: number; total: number }>();
  cards.forEach((card) => {
    const current = buckets.get(card.domain) ?? { label: card.domainLabel, promises: 0, total: 0 };
    current.promises += 1;
    current.total += card.similarityScore;
    buckets.set(card.domain, current);
  });
  return [...buckets.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      promises: value.promises,
      score: value.promises ? value.total / value.promises / 100 : 0,
    }))
    .sort((left, right) => right.promises - left.promises);
}

function buildOverallScore(cards: PromisesPayload["cards"]) {
  if (!cards.length) return 0;
  const similarityMean = cards.reduce((sum, card) => sum + card.similarityScore, 0) / cards.length;
  const statusWeight =
    cards.reduce((sum, card) => {
      if (card.status === "con_accion_registrada") return sum + 100;
      if (card.status === "en_seguimiento") return sum + 62;
      return sum + 24;
    }, 0) / cards.length;
  return Math.round(similarityMean * 0.58 + statusWeight * 0.42);
}

const ENRICHED_POLITICIANS: PoliticianMock[] = POLITICIANS.map((politician) => {
  const cards = expandPromiseCards(politician.cards);
  return {
    ...politician,
    cards,
    overallScore: buildOverallScore(cards),
    statusCounts: buildStatusCounts(cards),
    domains: buildDomainScores(cards),
  };
});

// ─── BUILD FUNCTIONS ─────────────────────────────────────────────────────────

function applyContractFilters(
  rows: typeof ALL_ROWS,
  filters: ContractsFilters,
): typeof ALL_ROWS {
  let result = [...rows];
  if (filters.department) {
    result = result.filter((r) => r.department === filters.department);
  }
  if (filters.risk && filters.risk !== "all") {
    result = result.filter((r) => r.riskBand === filters.risk);
  }
  if (filters.modality) {
    result = result.filter((r) =>
      r.modality.toLowerCase().includes(filters.modality!.toLowerCase()),
    );
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    result = result.filter(
      (r) =>
        r.entity.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getMockOverview(filters: ContractsFilters): OverviewPayload {
  const lang = filters.lang ?? "es";
  const filtered = applyContractFilters(ALL_ROWS, filters);
  const filteredLeadCases = applyContractFilters(LEAD_CASES, filters);
  const totalContracts = filters.department
    ? (MOCK_DEPARTMENTS.find((d) => d.value === filters.department)?.contractCount ?? filtered.length)
    : 1_234_890;
  const redAlerts = Math.round(totalContracts * 0.05);
  const prioritizedValue = filtered.filter((r) => r.riskBand === "high").reduce((s, r) => s + r.value, 0) || 124_500_000_000;
  const topDept = filters.department
    ? (MOCK_DEPARTMENTS.find((d) => d.value === filters.department)?.label ?? "Colombia")
    : "Bogotá D.C.";

  return {
    meta: {
      lang,
      fullDataset: filters.full ?? false,
      totalRows: 2_860_980,
      shownRows: totalContracts,
      previewRows: 50_000,
      latestContractDate: "2025-12-31",
      sourceLatestContractDate: "2026-04-02",
      sourceFreshnessGapDays: 92,
      sourceRows: 5_596_689,
      sourceUpdatedAt: "2026-04-03T17:47:26+0000",
      lastRunTs: "2026-01-01T03:15:00.000Z",
      dateRange: { from: "2023-01-01", to: "2025-12-31" },
    },
    options: {
      departments: MOCK_DEPARTMENTS.map((d) => ({ value: d.value, label: d.label })),
      modalities: MODALITIES,
    },
    map: {
      departments: MOCK_DEPARTMENTS.map((d) => ({
        key: d.value,
        label: d.label,
        geoName: d.geoName,
        avgRisk: d.avgRisk,
        contractCount: d.contractCount,
      })),
    },
    slice: {
      totalContracts,
      redAlerts,
      prioritizedValue,
      prioritizedValueLabel:
        prioritizedValue >= 1_000_000_000
          ? `$${(prioritizedValue / 1_000_000_000).toFixed(1)}B`
          : `$${(prioritizedValue / 1_000_000).toFixed(0)}M`,
      dominantDepartment: topDept,
    },
    benchmarks: {
      nationalMeanRisk: 0.52,
      sliceMeanRisk: filtered.length ? filtered.reduce((sum, row) => sum + row.score / 100, 0) / filtered.length : 0.52,
      departmentMeanRisk: filters.department
        ? (MOCK_DEPARTMENTS.find((d) => d.value === filters.department)?.avgRisk ?? null)
        : null,
      sliceMedianValue: filtered.length
        ? [...filtered].sort((left, right) => left.value - right.value)[Math.floor(filtered.length / 2)]?.value ?? 0
        : 3_240_000_000,
    },
    leadCases: (filteredLeadCases.length ? filteredLeadCases : LEAD_CASES).slice(0, 5),
    summaries: {
      entities: [
        { nombre_entidad: "UNIDAD NAL. GESTIÓN DEL RIESGO", contracts: 312, meanRisk: 0.76, maxRisk: 0.91 },
        { nombre_entidad: "INVÍAS", contracts: 284, meanRisk: 0.69, maxRisk: 0.88 },
        { nombre_entidad: "GOBERNACIÓN DEL CHOCÓ", contracts: 198, meanRisk: 0.72, maxRisk: 0.87 },
        { nombre_entidad: "GOBERNACIÓN DE SUCRE", contracts: 175, meanRisk: 0.70, maxRisk: 0.85 },
        { nombre_entidad: "GOBERNACIÓN DE LA GUAJIRA", contracts: 163, meanRisk: 0.78, maxRisk: 0.94 },
      ],
      modalities: [
        { modalidad_de_contratacion: "Contratación directa", contracts: 8_423, meanRisk: 0.68 },
        { modalidad_de_contratacion: "Selección abreviada", contracts: 12_180, meanRisk: 0.54 },
        { modalidad_de_contratacion: "Licitación pública", contracts: 6_842, meanRisk: 0.44 },
        { modalidad_de_contratacion: "Concurso de méritos", contracts: 2_310, meanRisk: 0.38 },
        { modalidad_de_contratacion: "Mínima cuantía", contracts: 18_940, meanRisk: 0.32 },
      ],
    },
    methodology: {
      modelType: "IsolationForest",
      nEstimators: 100,
      contamination: 0.05,
      nFeatures: 14,
      trainedAt: "2025-12-31",
      redThreshold: 0.7,
      yellowThreshold: 0.4,
    },
    liveFeed: {
      latestDate: "2026-04-02",
      rowsAtSource: 5_596_689,
      contracts: ALL_ROWS.slice(0, 5).map((r) => ({
        id: r.id,
        entity: r.entity,
        department: r.department,
        date: r.date,
        value: r.value,
        valueLabel: r.valueLabel,
        secopUrl: r.secopUrl,
      })),
    },
  };
}

export function getMockTable(
  filters: ContractsFilters & { offset?: number; limit?: number },
): TablePayload {
  const filtered = applyContractFilters(ALL_ROWS, filters);
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 24;
  const rows = filtered.slice(offset, offset + limit).map((r) => ({
    id: r.id,
    score: r.score,
    riskBand: r.riskBand,
    entity: r.entity,
    provider: r.provider,
    department: r.department,
    modality: r.modality,
    date: r.date,
    value: r.value,
    valueLabel: r.valueLabel,
    secopUrl: r.secopUrl,
  }));
  return { total: filtered.length, rows };
}

export function getMockFreshness(): ContractsFreshnessPayload {
  return {
    latestContractDate: "2025-12-31",
    sourceLatestContractDate: "2026-04-02",
    sourceFreshnessGapDays: 92,
    sourceRows: 5_596_689,
    sourceUpdatedAt: "2026-04-03T17:47:26+0000",
    liveFeed: {
      latestDate: "2026-04-02",
      rowsAtSource: 5_596_689,
      contracts: ALL_ROWS.slice(0, 5).map((r) => ({
        id: r.id,
        entity: r.entity,
        department: r.department,
        date: r.date,
        value: r.value,
        valueLabel: r.valueLabel,
        secopUrl: r.secopUrl,
      })),
    },
  };
}

export function getMockPromises(filters: PromiseFilters): PromisesPayload {
  const lang = filters.lang ?? "es";
  const pool = ENRICHED_POLITICIANS.filter((politician) => chamberMatches(politician.chamber, filters.chamber));
  const activePool = pool.length ? pool : ENRICHED_POLITICIANS;
  const pid = filters.politicianId ?? activePool[0].id;
  const politician = activePool.find((p) => p.id === pid) ?? activePool[0];

  let cards = [...politician.cards];
  if (filters.domain && filters.domain !== "all") {
    cards = cards.filter((c) => c.domain === filters.domain);
  }
  if (filters.status && filters.status !== "all") {
    cards = cards.filter((c) => c.status === filters.status);
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.promiseText.toLowerCase().includes(q) ||
        c.actionTitle.toLowerCase().includes(q) ||
        c.domainLabel.toLowerCase().includes(q),
    );
  }

  let sandboxCards = activePool.flatMap((item) => item.cards);
  if (filters.domain && filters.domain !== "all") {
    sandboxCards = sandboxCards.filter((card) => card.domain === filters.domain);
  }
  if (filters.status && filters.status !== "all") {
    sandboxCards = sandboxCards.filter((card) => card.status === filters.status);
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    sandboxCards = sandboxCards.filter(
      (card) =>
        card.promiseText.toLowerCase().includes(q) ||
        card.actionTitle.toLowerCase().includes(q) ||
        card.domainLabel.toLowerCase().includes(q) ||
        card.politicianName.toLowerCase().includes(q),
    );
  }

  const allDomainValues = [...new Set(sandboxCards.map((c) => c.domain))];
  const domainOptions = [
    { value: "all", label: lang === "es" ? "Todos" : "All" },
    ...allDomainValues.map((d) => ({
      value: d,
      label: sandboxCards.find((c) => c.domain === d)?.domainLabel ?? d,
    })),
  ];

  const statusOptions = [
    { value: "all", label: lang === "es" ? "Todos" : "All" },
    { value: "con_accion_registrada", label: lang === "es" ? "Con acción registrada" : "With registered action" },
    { value: "en_seguimiento", label: lang === "es" ? "En seguimiento" : "Under monitoring" },
    { value: "sin_accion_registrada", label: lang === "es" ? "Sin evidencia" : "No evidence" },
  ];

  return {
    meta: {
      lang,
      coverageMode: "pilot",
      electionYear: filters.electionYear ?? 2022,
      totalRows: sandboxCards.length,
      shownRows: cards.length,
      lastScoredAt: "2025-03-28",
      pilotNote:
        lang === "es"
          ? "Cobertura visible del tablero: promesas, subcompromisos y acciones públicas agrupadas para seguir temas, actores y estado del periodo."
          : "Visible board coverage: promises, sub-commitments, and public actions grouped to follow themes, actors, and cycle status.",
    },
    options: {
      politicians: activePool.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.role}`,
      })),
      domains: domainOptions,
      statuses: statusOptions,
      years: [2018, 2022, 2026],
    },
    kpis: {
      politiciansTracked: activePool.length,
      promisesTracked: sandboxCards.length,
      coherenceRate: Math.round(
        (activePool.reduce((s, p) => s + p.statusCounts.fulfilled, 0) /
          Math.max(activePool.reduce((s, p) => s + p.cards.length, 0), 1)) *
          100,
      ),
      activeDomains: new Set(sandboxCards.map((card) => card.domain)).size,
    },
    scorecard: {
      politicianId: politician.id,
      politicianName: politician.name,
      chamber: politician.chamber,
      party: politician.party,
      overallScore: politician.overallScore,
      statusCounts: politician.statusCounts,
      domains: politician.domains,
    },
    cards,
    sandboxCards,
    highlights: {
      focusPolitician: politician.name,
      focusDomain: sandboxCards[0]?.domainLabel ?? politician.domains[0]?.label ?? "—",
      focusStatus:
        lang === "es"
          ? politician.statusCounts.monitoring > politician.statusCounts.fulfilled
            ? "En seguimiento"
            : "Con acción registrada"
          : politician.statusCounts.monitoring > politician.statusCounts.fulfilled
            ? "Under monitoring"
            : "With registered action",
    },
  };
}
