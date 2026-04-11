export type Lang = "es" | "en";

export type DepartmentDatum = {
  key: string;
  label: string;
  geoName: string;
  avgRisk: number;
  contractCount: number;
};

export type LeadFactor = {
  key: string;
  label: string;
  severity: number;
};

export type LeadCase = {
  id: string;
  score: number;
  riskBand: "high" | "medium" | "low";
  entity: string;
  provider: string;
  department: string;
  modality: string;
  date: string;
  value: number;
  valueLabel: string;
  secopUrl: string;
  pickReason: string;
  signal: string;
  factors: LeadFactor[];
};

export type OverviewPayload = {
  meta: {
    lang: Lang;
    fullDataset: boolean;
    totalRows: number;
    shownRows: number;
    previewRows: number;
    latestContractDate?: string | null;
    sourceLatestContractDate?: string | null;
    sourceFreshnessGapDays?: number | null;
    sourceRows?: number | null;
    sourceUpdatedAt?: string | null;
    lastRunTs?: string | null;
    dateRange?: {
      from?: string | null;
      to?: string | null;
    };
  };
  options: {
    departments: { value: string; label: string }[];
    modalities: { value: string; label: string }[];
  };
  map: {
    departments: DepartmentDatum[];
  };
  slice: {
    totalContracts: number;
    redAlerts: number;
    prioritizedValue: number;
    prioritizedValueLabel: string;
    dominantDepartment: string;
  };
  benchmarks: {
    nationalMeanRisk: number;
    sliceMeanRisk: number;
    departmentMeanRisk?: number | null;
    sliceMedianValue: number;
  };
  leadCases: LeadCase[];
  summaries: {
    entities: { nombre_entidad: string; contracts: number; meanRisk: number; maxRisk: number }[];
    modalities: { modalidad_de_contratacion: string; contracts: number; meanRisk: number }[];
  };
  analytics: {
    departments: DepartmentDatum[];
    modalities: { modalidad_de_contratacion: string; contracts: number; meanRisk: number }[];
    entities: { nombre_entidad: string; contracts: number; meanRisk: number; maxRisk: number }[];
    months: { month: string; contracts: number; meanRisk: number }[];
    riskBands: { riskBand: "high" | "medium" | "low"; contracts: number; meanRisk: number }[];
  };
  methodology: {
    modelType: string;
    nEstimators: number;
    contamination: number;
    nFeatures: number;
    trainedAt?: string | null;
    redThreshold: number;
    yellowThreshold: number;
  };
  liveFeed: {
    latestDate?: string | null;
    rowsAtSource?: number | null;
    contracts: {
      id: string;
      entity: string;
      department: string;
      date: string;
      value: number;
      valueLabel: string;
      secopUrl: string;
    }[];
  };
};

export type ContractsFreshnessPayload = {
  latestContractDate?: string | null;
  sourceLatestContractDate?: string | null;
  sourceFreshnessGapDays?: number | null;
  sourceRows?: number | null;
  sourceUpdatedAt?: string | null;
  liveFeed: {
    latestDate?: string | null;
    rowsAtSource?: number | null;
    contracts: {
      id: string;
      entity: string;
      department: string;
      date: string;
      value: number;
      valueLabel: string;
      secopUrl: string;
    }[];
  };
};

export type TableRow = {
  id: string;
  score: number;
  riskBand: "high" | "medium" | "low";
  entity: string;
  provider: string;
  department: string;
  modality: string;
  date: string;
  value: number;
  valueLabel: string;
  secopUrl: string;
};

export type TablePayload = {
  total: number;
  rows: TableRow[];
};

export type PromiseScoreDomain = {
  key: string;
  label: string;
  score: number;
  promises: number;
};

export type PromiseCard = {
  id: string;
  promiseId: string;
  politicianId: string;
  politicianName: string;
  domain: string;
  domainLabel: string;
  status: "con_accion_registrada" | "en_seguimiento" | "sin_accion_registrada";
  statusLabel: string;
  similarityScore: number;
  statusConfidence: number;
  extractionConfidence: number;
  promiseText: string;
  promiseSourceUrl: string;
  promiseSourceLabel: string;
  actionTitle: string;
  actionSummary: string;
  actionDate: string;
  actionSourceUrl: string;
  actionSourceSystem: string;
};

export type PromisesPayload = {
  meta: {
    lang: Lang;
    coverageMode: "live" | "pilot";
    electionYear: number;
    totalRows: number;
    shownRows: number;
    lastScoredAt?: string | null;
    pilotNote: string;
  };
  options: {
    politicians: { value: string; label: string }[];
    domains: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
    years: number[];
  };
  kpis: {
    politiciansTracked: number;
    promisesTracked: number;
    coherenceRate: number;
    activeDomains: number;
  };
  scorecard: {
    politicianId: string;
    politicianName: string;
    chamber: string;
    party: string;
    overallScore: number;
    statusCounts: {
      fulfilled: number;
      monitoring: number;
      noAction: number;
    };
    domains: PromiseScoreDomain[];
  };
  cards: PromiseCard[];
  sandboxCards: PromiseCard[];
  highlights: {
    focusPolitician: string;
    focusDomain: string;
    focusStatus: string;
  };
};
