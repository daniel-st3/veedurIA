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
  leadCases: LeadCase[];
  summaries: {
    entities: { nombre_entidad: string; contracts: number; meanRisk: number; maxRisk: number }[];
    modalities: { modalidad_de_contratacion: string; contracts: number; meanRisk: number }[];
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
