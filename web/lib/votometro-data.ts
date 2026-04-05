export type VotePeriodKey = "2018-2022" | "2022-2026" | "2026";
export type VoteChamberKey = "all" | "senado" | "camara";
export type VotePosition = "Sí" | "No" | "Ausente" | "Impedimento";
export type VoteCoherence = "coherente" | "inconsistente" | "sin-promesa";
export type HeatmapState = "coherente" | "inconsistente" | "ausente" | "sin-dato";

export type VoteThemeBar = {
  key: string;
  label: string;
  score: number;
};

export type VoteRecord = {
  id: string;
  project: string;
  date: string;
  dateLabel: string;
  theme: string;
  position: VotePosition;
  result: "Aprobado" | "Rechazado" | "Archivado";
  coherence: VoteCoherence;
  gaceta: string;
  gacetaHref: string;
  deviatesFromBench: boolean;
};

export type HeatmapCell = {
  key: string;
  label: string;
  value: number | null;
  state: HeatmapState;
  position?: VotePosition;
  project?: string;
  dateLabel?: string;
  gaceta?: string;
};

export type VotometroLegislator = {
  id: string;
  name: string;
  initials: string;
  chamber: Exclude<VoteChamberKey, "all">;
  chamberLabel: string;
  roleLabel: string;
  party: string;
  partyColor: string;
  periods: VotePeriodKey[];
  coherenceScore: number;
  totalVotes: number;
  absenceRate: number;
  topicCount: number;
  consistentVotes: number;
  inconsistentVotes: number;
  absencesOnKeyThemes: number;
  partyDeviationVotes: number;
  contractsCount: number;
  contractsQuery: string;
  themeBars: VoteThemeBar[];
  topTopics: string[];
  voteRows: VoteRecord[];
  heatmap: HeatmapCell[];
};

export const VOTOMETRO_PERIODS: { key: VotePeriodKey; label: string }[] = [
  { key: "2018-2022", label: "2018-2022 · Referencia" },
  { key: "2022-2026", label: "2022-2026 · Activo ●" },
  { key: "2026", label: "2026 · Preelectoral" },
];

export const VOTOMETRO_CHAMBERS: { key: VoteChamberKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "senado", label: "Senado" },
  { key: "camara", label: "Cámara de Representantes" },
];

export const HEATMAP_COLUMNS = [
  { key: "paz", label: "Paz total" },
  { key: "salud", label: "Salud" },
  { key: "justicia", label: "Justicia" },
  { key: "pensiones", label: "Pensiones" },
  { key: "economia", label: "Economía" },
  { key: "ambiente", label: "Ambiente" },
  { key: "derechos", label: "Derechos" },
  { key: "anticorrupcion", label: "Anticorrupción" },
  { key: "energia", label: "Energía" },
  { key: "educacion", label: "Educación" },
  { key: "seguridad", label: "Seguridad" },
  { key: "presupuesto", label: "Presupuesto" },
] as const;

const HERO_STATS: Record<
  VotePeriodKey,
  Record<
    VoteChamberKey,
    {
      indexedVotes: number;
      legislators: number;
      trackedProjects: number;
      coherenceAverage: number;
    }
  >
> = {
  "2018-2022": {
    all: { indexedVotes: 1542, legislators: 236, trackedProjects: 274, coherenceAverage: 61 },
    senado: { indexedVotes: 782, legislators: 103, trackedProjects: 141, coherenceAverage: 60 },
    camara: { indexedVotes: 760, legislators: 133, trackedProjects: 133, coherenceAverage: 62 },
  },
  "2022-2026": {
    all: { indexedVotes: 1847, legislators: 284, trackedProjects: 312, coherenceAverage: 63 },
    senado: { indexedVotes: 968, legislators: 122, trackedProjects: 171, coherenceAverage: 64 },
    camara: { indexedVotes: 879, legislators: 162, trackedProjects: 141, coherenceAverage: 61 },
  },
  "2026": {
    all: { indexedVotes: 428, legislators: 96, trackedProjects: 57, coherenceAverage: 59 },
    senado: { indexedVotes: 221, legislators: 42, trackedProjects: 31, coherenceAverage: 61 },
    camara: { indexedVotes: 207, legislators: 54, trackedProjects: 26, coherenceAverage: 56 },
  },
};

type TopicTemplate = {
  key: (typeof HEATMAP_COLUMNS)[number]["key"];
  theme: string;
  project: string;
  date: string;
  result: "Aprobado" | "Rechazado" | "Archivado";
  gaceta: string;
};

const VOTE_TEMPLATES: TopicTemplate[] = [
  {
    key: "salud",
    theme: "Salud",
    project: "Proyecto de Ley 227 — Reforma al sistema de salud",
    date: "2024-03-15",
    result: "Aprobado",
    gaceta: "#089/2024",
  },
  {
    key: "paz",
    theme: "Paz",
    project: "Proyecto de Ley 010 — Paz total, primera fase",
    date: "2023-08-22",
    result: "Aprobado",
    gaceta: "#312/2023",
  },
  {
    key: "justicia",
    theme: "Justicia",
    project: "Acto Legislativo 02 — Reforma carcelaria",
    date: "2024-06-10",
    result: "Aprobado",
    gaceta: "#201/2024",
  },
  {
    key: "pensiones",
    theme: "Pensiones",
    project: "Proyecto de Ley 197 — Reforma pensional",
    date: "2024-06-14",
    result: "Aprobado",
    gaceta: "#187/2024",
  },
  {
    key: "economia",
    theme: "Economía",
    project: "Moción de censura — Ministro de Hacienda",
    date: "2023-09-05",
    result: "Rechazado",
    gaceta: "#389/2023",
  },
  {
    key: "ambiente",
    theme: "Ambiente",
    project: "Proyecto de Ley 053 — Fracking",
    date: "2023-11-20",
    result: "Rechazado",
    gaceta: "#421/2023",
  },
  {
    key: "presupuesto",
    theme: "Presupuesto",
    project: "Proyecto de Ley 198 — Presupuesto General 2025",
    date: "2023-10-18",
    result: "Aprobado",
    gaceta: "#435/2023",
  },
  {
    key: "derechos",
    theme: "Derechos",
    project: "Proyecto de Ley 134 — Comunidades étnicas",
    date: "2024-04-04",
    result: "Archivado",
    gaceta: "#112/2024",
  },
  {
    key: "energia",
    theme: "Energía",
    project: "Proyecto de Ley 066 — Transición energética",
    date: "2024-03-15",
    result: "Aprobado",
    gaceta: "#093/2024",
  },
  {
    key: "anticorrupcion",
    theme: "Anticorrupción",
    project: "Proyecto de Ley 201 — Estatuto anticorrupción",
    date: "2024-07-22",
    result: "Archivado",
    gaceta: "#278/2024",
  },
  {
    key: "educacion",
    theme: "Educación",
    project: "Proyecto de Ley 154 — Educación rural",
    date: "2024-02-07",
    result: "Aprobado",
    gaceta: "#047/2024",
  },
  {
    key: "seguridad",
    theme: "Seguridad",
    project: "Proyecto de Ley 088 — Seguridad urbana",
    date: "2024-05-29",
    result: "Aprobado",
    gaceta: "#166/2024",
  },
];

type TopicState = {
  position: VotePosition;
  coherence: VoteCoherence;
  score: number | null;
  deviates: boolean;
};

type PatternKey = "progresista" | "verde" | "oposicion" | "centro";

const PATTERNS: Record<PatternKey, Record<TopicTemplate["key"], TopicState>> = {
  progresista: {
    paz: { position: "Sí", coherence: "coherente", score: 74, deviates: false },
    salud: { position: "Sí", coherence: "coherente", score: 68, deviates: false },
    justicia: { position: "Ausente", coherence: "inconsistente", score: null, deviates: false },
    pensiones: { position: "Sí", coherence: "coherente", score: 71, deviates: false },
    economia: { position: "No", coherence: "sin-promesa", score: 49, deviates: true },
    ambiente: { position: "No", coherence: "coherente", score: 64, deviates: false },
    derechos: { position: "Ausente", coherence: "inconsistente", score: null, deviates: false },
    anticorrupcion: { position: "No", coherence: "inconsistente", score: 38, deviates: false },
    energia: { position: "Sí", coherence: "coherente", score: 78, deviates: false },
    educacion: { position: "Sí", coherence: "coherente", score: 66, deviates: false },
    seguridad: { position: "No", coherence: "inconsistente", score: 39, deviates: true },
    presupuesto: { position: "Sí", coherence: "sin-promesa", score: 52, deviates: false },
  },
  verde: {
    paz: { position: "Sí", coherence: "coherente", score: 69, deviates: false },
    salud: { position: "Sí", coherence: "coherente", score: 76, deviates: false },
    justicia: { position: "Sí", coherence: "sin-promesa", score: 52, deviates: true },
    pensiones: { position: "Sí", coherence: "coherente", score: 73, deviates: false },
    economia: { position: "No", coherence: "sin-promesa", score: 47, deviates: false },
    ambiente: { position: "No", coherence: "coherente", score: 84, deviates: false },
    derechos: { position: "Sí", coherence: "coherente", score: 77, deviates: false },
    anticorrupcion: { position: "Sí", coherence: "coherente", score: 81, deviates: false },
    energia: { position: "Sí", coherence: "coherente", score: 88, deviates: false },
    educacion: { position: "Sí", coherence: "coherente", score: 74, deviates: false },
    seguridad: { position: "Ausente", coherence: "inconsistente", score: null, deviates: false },
    presupuesto: { position: "Sí", coherence: "sin-promesa", score: 48, deviates: false },
  },
  oposicion: {
    paz: { position: "No", coherence: "coherente", score: 79, deviates: false },
    salud: { position: "No", coherence: "coherente", score: 82, deviates: false },
    justicia: { position: "Sí", coherence: "coherente", score: 72, deviates: false },
    pensiones: { position: "No", coherence: "coherente", score: 76, deviates: false },
    economia: { position: "Sí", coherence: "coherente", score: 83, deviates: false },
    ambiente: { position: "Sí", coherence: "inconsistente", score: 34, deviates: true },
    derechos: { position: "No", coherence: "inconsistente", score: 28, deviates: false },
    anticorrupcion: { position: "Sí", coherence: "coherente", score: 85, deviates: false },
    energia: { position: "No", coherence: "coherente", score: 73, deviates: false },
    educacion: { position: "No", coherence: "inconsistente", score: 37, deviates: true },
    seguridad: { position: "Sí", coherence: "coherente", score: 91, deviates: false },
    presupuesto: { position: "Sí", coherence: "coherente", score: 80, deviates: false },
  },
  centro: {
    paz: { position: "Impedimento", coherence: "sin-promesa", score: 50, deviates: false },
    salud: { position: "Sí", coherence: "coherente", score: 61, deviates: false },
    justicia: { position: "Ausente", coherence: "inconsistente", score: null, deviates: false },
    pensiones: { position: "Sí", coherence: "coherente", score: 67, deviates: false },
    economia: { position: "No", coherence: "sin-promesa", score: 47, deviates: false },
    ambiente: { position: "No", coherence: "coherente", score: 62, deviates: false },
    derechos: { position: "Sí", coherence: "coherente", score: 58, deviates: false },
    anticorrupcion: { position: "Sí", coherence: "coherente", score: 64, deviates: false },
    energia: { position: "Sí", coherence: "coherente", score: 70, deviates: true },
    educacion: { position: "Sí", coherence: "coherente", score: 63, deviates: false },
    seguridad: { position: "No", coherence: "inconsistente", score: 41, deviates: true },
    presupuesto: { position: "Sí", coherence: "sin-promesa", score: 55, deviates: false },
  },
};

type LegislatorSeed = Omit<VotometroLegislator, "voteRows" | "heatmap" | "topTopics"> & {
  pattern: PatternKey;
};

const LEGISLATOR_SEEDS: LegislatorSeed[] = [
  {
    id: "gustavo-petro",
    name: "Gustavo Petro",
    initials: "GP",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senador · Colombia Humana",
    party: "Colombia Humana",
    partyColor: "#6d5f8f",
    periods: ["2018-2022", "2026"],
    coherenceScore: 63,
    totalVotes: 138,
    absenceRate: 12,
    topicCount: 3,
    consistentVotes: 47,
    inconsistentVotes: 28,
    absencesOnKeyThemes: 8,
    partyDeviationVotes: 4,
    contractsCount: 3,
    contractsQuery: "Gustavo Petro",
    themeBars: [
      { key: "paz", label: "Paz total", score: 54 },
      { key: "salud", label: "Reforma salud", score: 48 },
      { key: "energia", label: "Transición energética", score: 78 },
      { key: "pensiones", label: "Reforma pensional", score: 71 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 62 },
      { key: "seguridad", label: "Seguridad", score: 39 },
    ],
    pattern: "progresista",
  },
  {
    id: "francia-marquez",
    name: "Francia Márquez",
    initials: "FM",
    chamber: "camara",
    chamberLabel: "Cámara",
    roleLabel: "Representante · Pacto Histórico",
    party: "Pacto Histórico",
    partyColor: "#476c67",
    periods: ["2022-2026", "2026"],
    coherenceScore: 71,
    totalVotes: 122,
    absenceRate: 9,
    topicCount: 4,
    consistentVotes: 51,
    inconsistentVotes: 21,
    absencesOnKeyThemes: 6,
    partyDeviationVotes: 3,
    contractsCount: 1,
    contractsQuery: "Francia Marquez",
    themeBars: [
      { key: "paz", label: "Paz total", score: 72 },
      { key: "salud", label: "Reforma salud", score: 69 },
      { key: "energia", label: "Transición energética", score: 86 },
      { key: "pensiones", label: "Reforma pensional", score: 74 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 66 },
      { key: "seguridad", label: "Seguridad", score: 45 },
    ],
    pattern: "progresista",
  },
  {
    id: "maria-jose-pizarro",
    name: "María José Pizarro",
    initials: "MP",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senadora · Colombia Humana",
    party: "Colombia Humana",
    partyColor: "#6d5f8f",
    periods: ["2018-2022", "2022-2026"],
    coherenceScore: 58,
    totalVotes: 146,
    absenceRate: 14,
    topicCount: 3,
    consistentVotes: 44,
    inconsistentVotes: 32,
    absencesOnKeyThemes: 11,
    partyDeviationVotes: 5,
    contractsCount: 2,
    contractsQuery: "Maria Jose Pizarro",
    themeBars: [
      { key: "paz", label: "Paz total", score: 59 },
      { key: "salud", label: "Reforma salud", score: 52 },
      { key: "energia", label: "Transición energética", score: 73 },
      { key: "pensiones", label: "Reforma pensional", score: 68 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 55 },
      { key: "seguridad", label: "Seguridad", score: 31 },
    ],
    pattern: "progresista",
  },
  {
    id: "paloma-valencia",
    name: "Paloma Valencia",
    initials: "PV",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senadora · Centro Democrático",
    party: "Centro Democrático",
    partyColor: "#335d8d",
    periods: ["2018-2022", "2022-2026", "2026"],
    coherenceScore: 82,
    totalVotes: 167,
    absenceRate: 4,
    topicCount: 4,
    consistentVotes: 67,
    inconsistentVotes: 15,
    absencesOnKeyThemes: 3,
    partyDeviationVotes: 2,
    contractsCount: 4,
    contractsQuery: "Paloma Valencia",
    themeBars: [
      { key: "paz", label: "Paz total", score: 79 },
      { key: "salud", label: "Reforma salud", score: 82 },
      { key: "energia", label: "Transición energética", score: 73 },
      { key: "pensiones", label: "Reforma pensional", score: 76 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 85 },
      { key: "seguridad", label: "Seguridad", score: 91 },
    ],
    pattern: "oposicion",
  },
  {
    id: "katherine-miranda",
    name: "Katherine Miranda",
    initials: "KM",
    chamber: "camara",
    chamberLabel: "Cámara",
    roleLabel: "Representante · Alianza Verde",
    party: "Alianza Verde",
    partyColor: "#4f7d56",
    periods: ["2022-2026", "2026"],
    coherenceScore: 76,
    totalVotes: 141,
    absenceRate: 7,
    topicCount: 4,
    consistentVotes: 58,
    inconsistentVotes: 18,
    absencesOnKeyThemes: 5,
    partyDeviationVotes: 6,
    contractsCount: 2,
    contractsQuery: "Katherine Miranda",
    themeBars: [
      { key: "paz", label: "Paz total", score: 69 },
      { key: "salud", label: "Reforma salud", score: 76 },
      { key: "energia", label: "Transición energética", score: 88 },
      { key: "pensiones", label: "Reforma pensional", score: 73 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 81 },
      { key: "seguridad", label: "Seguridad", score: 34 },
    ],
    pattern: "verde",
  },
  {
    id: "inti-asprilla",
    name: "Inti Asprilla",
    initials: "IA",
    chamber: "camara",
    chamberLabel: "Cámara",
    roleLabel: "Representante · Alianza Verde",
    party: "Alianza Verde",
    partyColor: "#4f7d56",
    periods: ["2018-2022", "2022-2026"],
    coherenceScore: 69,
    totalVotes: 132,
    absenceRate: 11,
    topicCount: 3,
    consistentVotes: 49,
    inconsistentVotes: 22,
    absencesOnKeyThemes: 7,
    partyDeviationVotes: 5,
    contractsCount: 0,
    contractsQuery: "Inti Asprilla",
    themeBars: [
      { key: "paz", label: "Paz total", score: 67 },
      { key: "salud", label: "Reforma salud", score: 72 },
      { key: "energia", label: "Transición energética", score: 83 },
      { key: "pensiones", label: "Reforma pensional", score: 69 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 74 },
      { key: "seguridad", label: "Seguridad", score: 28 },
    ],
    pattern: "verde",
  },
  {
    id: "david-luna",
    name: "David Luna",
    initials: "DL",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senador · Cambio Radical",
    party: "Cambio Radical",
    partyColor: "#8d7a4f",
    periods: ["2018-2022", "2022-2026", "2026"],
    coherenceScore: 74,
    totalVotes: 159,
    absenceRate: 8,
    topicCount: 4,
    consistentVotes: 59,
    inconsistentVotes: 21,
    absencesOnKeyThemes: 6,
    partyDeviationVotes: 4,
    contractsCount: 1,
    contractsQuery: "David Luna",
    themeBars: [
      { key: "paz", label: "Paz total", score: 50 },
      { key: "salud", label: "Reforma salud", score: 61 },
      { key: "energia", label: "Transición energética", score: 70 },
      { key: "pensiones", label: "Reforma pensional", score: 67 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 64 },
      { key: "seguridad", label: "Seguridad", score: 41 },
    ],
    pattern: "centro",
  },
  {
    id: "rodrigo-lara",
    name: "Rodrigo Lara",
    initials: "RL",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senador · Cambio Radical",
    party: "Cambio Radical",
    partyColor: "#8d7a4f",
    periods: ["2018-2022", "2022-2026"],
    coherenceScore: 61,
    totalVotes: 143,
    absenceRate: 13,
    topicCount: 3,
    consistentVotes: 46,
    inconsistentVotes: 29,
    absencesOnKeyThemes: 9,
    partyDeviationVotes: 7,
    contractsCount: 2,
    contractsQuery: "Rodrigo Lara",
    themeBars: [
      { key: "paz", label: "Paz total", score: 46 },
      { key: "salud", label: "Reforma salud", score: 58 },
      { key: "energia", label: "Transición energética", score: 64 },
      { key: "pensiones", label: "Reforma pensional", score: 63 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 60 },
      { key: "seguridad", label: "Seguridad", score: 43 },
    ],
    pattern: "centro",
  },
  {
    id: "angelica-lozano",
    name: "Angélica Lozano",
    initials: "AL",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senadora · Alianza Verde",
    party: "Alianza Verde",
    partyColor: "#4f7d56",
    periods: ["2018-2022", "2022-2026", "2026"],
    coherenceScore: 79,
    totalVotes: 165,
    absenceRate: 6,
    topicCount: 4,
    consistentVotes: 62,
    inconsistentVotes: 17,
    absencesOnKeyThemes: 5,
    partyDeviationVotes: 4,
    contractsCount: 1,
    contractsQuery: "Angelica Lozano",
    themeBars: [
      { key: "paz", label: "Paz total", score: 71 },
      { key: "salud", label: "Reforma salud", score: 77 },
      { key: "energia", label: "Transición energética", score: 89 },
      { key: "pensiones", label: "Reforma pensional", score: 75 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 84 },
      { key: "seguridad", label: "Seguridad", score: 37 },
    ],
    pattern: "verde",
  },
  {
    id: "jota-pe-hernandez",
    name: "Jota Pe Hernández",
    initials: "JH",
    chamber: "senado",
    chamberLabel: "Senado",
    roleLabel: "Senador · Alianza Verde",
    party: "Alianza Verde",
    partyColor: "#4f7d56",
    periods: ["2022-2026", "2026"],
    coherenceScore: 55,
    totalVotes: 151,
    absenceRate: 16,
    topicCount: 3,
    consistentVotes: 41,
    inconsistentVotes: 34,
    absencesOnKeyThemes: 12,
    partyDeviationVotes: 10,
    contractsCount: 0,
    contractsQuery: "Jota Pe Hernandez",
    themeBars: [
      { key: "paz", label: "Paz total", score: 44 },
      { key: "salud", label: "Reforma salud", score: 55 },
      { key: "energia", label: "Transición energética", score: 61 },
      { key: "pensiones", label: "Reforma pensional", score: 59 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 52 },
      { key: "seguridad", label: "Seguridad", score: 48 },
    ],
    pattern: "centro",
  },
  {
    id: "cathy-juvinao",
    name: "Cathy Juvinao",
    initials: "CJ",
    chamber: "camara",
    chamberLabel: "Cámara",
    roleLabel: "Representante · Alianza Verde",
    party: "Alianza Verde",
    partyColor: "#4f7d56",
    periods: ["2022-2026", "2026"],
    coherenceScore: 72,
    totalVotes: 137,
    absenceRate: 9,
    topicCount: 4,
    consistentVotes: 54,
    inconsistentVotes: 21,
    absencesOnKeyThemes: 6,
    partyDeviationVotes: 5,
    contractsCount: 1,
    contractsQuery: "Cathy Juvinao",
    themeBars: [
      { key: "paz", label: "Paz total", score: 62 },
      { key: "salud", label: "Reforma salud", score: 75 },
      { key: "energia", label: "Transición energética", score: 82 },
      { key: "pensiones", label: "Reforma pensional", score: 70 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 77 },
      { key: "seguridad", label: "Seguridad", score: 36 },
    ],
    pattern: "verde",
  },
  {
    id: "andres-forero",
    name: "Andrés Forero",
    initials: "AF",
    chamber: "camara",
    chamberLabel: "Cámara",
    roleLabel: "Representante · Centro Democrático",
    party: "Centro Democrático",
    partyColor: "#335d8d",
    periods: ["2022-2026", "2026"],
    coherenceScore: 88,
    totalVotes: 173,
    absenceRate: 3,
    topicCount: 4,
    consistentVotes: 72,
    inconsistentVotes: 10,
    absencesOnKeyThemes: 2,
    partyDeviationVotes: 1,
    contractsCount: 0,
    contractsQuery: "Andres Forero",
    themeBars: [
      { key: "paz", label: "Paz total", score: 83 },
      { key: "salud", label: "Reforma salud", score: 88 },
      { key: "energia", label: "Transición energética", score: 76 },
      { key: "pensiones", label: "Reforma pensional", score: 81 },
      { key: "anticorrupcion", label: "Anticorrupción", score: 87 },
      { key: "seguridad", label: "Seguridad", score: 92 },
    ],
    pattern: "oposicion",
  },
];

function buildVoteRows(pattern: PatternKey) {
  const themeStates = PATTERNS[pattern];

  return VOTE_TEMPLATES.map((template, index) => {
    const topicState = themeStates[template.key];
    return {
      id: `${pattern}-${template.key}-${index + 1}`,
      project: template.project,
      date: template.date,
      dateLabel: formatDateLabel(template.date),
      theme: template.theme,
      position: topicState.position,
      result: template.result,
      coherence: topicState.coherence,
      gaceta: template.gaceta,
      gacetaHref: "#",
      deviatesFromBench: topicState.deviates,
    } satisfies VoteRecord;
  });
}

function buildHeatmap(pattern: PatternKey) {
  const themeStates = PATTERNS[pattern];

  return HEATMAP_COLUMNS.map((column) => {
    const template = VOTE_TEMPLATES.find((item) => item.key === column.key);
    const state = themeStates[column.key];
    return {
      key: column.key,
      label: column.label,
      value: state.score,
      state:
        state.position === "Ausente"
          ? "ausente"
          : state.coherence === "coherente"
            ? "coherente"
            : state.coherence === "inconsistente"
              ? "inconsistente"
              : "sin-dato",
      position: state.position,
      project: template?.project,
      dateLabel: template?.date ? formatDateLabel(template.date) : undefined,
      gaceta: template?.gaceta,
    } satisfies HeatmapCell;
  });
}

function formatDateLabel(date: string) {
  const value = new Date(`${date}T00:00:00-05:00`);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export const VOTOMETRO_LEGISLATORS: VotometroLegislator[] = LEGISLATOR_SEEDS.map((seed) => {
  const { pattern, ...profile } = seed;
  return {
    ...profile,
    topTopics: [...seed.themeBars].sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.label),
    voteRows: buildVoteRows(pattern),
    heatmap: buildHeatmap(pattern),
  };
});

export function getHeroStats(period: VotePeriodKey, chamber: VoteChamberKey) {
  return HERO_STATS[period][chamber];
}
