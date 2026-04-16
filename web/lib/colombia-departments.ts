const GEO_DEPARTMENT_NAMES = [
  "AMAZONAS",
  "ANTIOQUIA",
  "ARAUCA",
  "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "ATLANTICO",
  "BOLIVAR",
  "BOYACA",
  "CALDAS",
  "CAQUETA",
  "CASANARE",
  "CAUCA",
  "CESAR",
  "CHOCO",
  "CORDOBA",
  "CUNDINAMARCA",
  "GUAINIA",
  "GUAVIARE",
  "HUILA",
  "LA GUAJIRA",
  "MAGDALENA",
  "META",
  "NARIÑO",
  "NORTE DE SANTANDER",
  "PUTUMAYO",
  "QUINDIO",
  "RISARALDA",
  "SANTAFE DE BOGOTA D.C",
  "SANTANDER",
  "SUCRE",
  "TOLIMA",
  "VALLE DEL CAUCA",
  "VAUPES",
  "VICHADA",
] as const;

const SPECIAL_GEO_ALIASES: Record<string, string> = {
  BOGOTA: "SANTAFE DE BOGOTA D.C",
  "BOGOTA DC": "SANTAFE DE BOGOTA D.C",
  "BOGOTA D C": "SANTAFE DE BOGOTA D.C",
  "BOGOTA D.C": "SANTAFE DE BOGOTA D.C",
  "BOGOTA D.C.": "SANTAFE DE BOGOTA D.C",
  "DISTRITO CAPITAL DE BOGOTA": "SANTAFE DE BOGOTA D.C",
  "DISTRITO CAPITAL BOGOTA": "SANTAFE DE BOGOTA D.C",
  "BOGOTA DISTRITO CAPITAL": "SANTAFE DE BOGOTA D.C",
  "SANTA FE DE BOGOTA D C": "SANTAFE DE BOGOTA D.C",
  "SANTAFE DE BOGOTA D C": "SANTAFE DE BOGOTA D.C",
  "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "SAN ANDRES Y PROVIDENCIA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "SAN ANDRES PROVIDENCIA SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "SAN ANDRES, PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
  "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA":
    "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
};

const DISPLAY_LABELS: Record<string, string> = {
  AMAZONAS: "Amazonas",
  ANTIOQUIA: "Antioquia",
  ARAUCA: "Arauca",
  "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "San Andrés y Providencia",
  ATLANTICO: "Atlántico",
  BOLIVAR: "Bolívar",
  BOYACA: "Boyacá",
  CALDAS: "Caldas",
  CAQUETA: "Caquetá",
  CASANARE: "Casanare",
  CAUCA: "Cauca",
  CESAR: "Cesar",
  CHOCO: "Chocó",
  CORDOBA: "Córdoba",
  CUNDINAMARCA: "Cundinamarca",
  GUAINIA: "Guainía",
  GUAVIARE: "Guaviare",
  HUILA: "Huila",
  "LA GUAJIRA": "La Guajira",
  MAGDALENA: "Magdalena",
  META: "Meta",
  "NARIÑO": "Nariño",
  "NORTE DE SANTANDER": "Norte de Santander",
  PUTUMAYO: "Putumayo",
  QUINDIO: "Quindío",
  RISARALDA: "Risaralda",
  "SANTAFE DE BOGOTA D.C": "Bogotá D.C.",
  SANTANDER: "Santander",
  SUCRE: "Sucre",
  TOLIMA: "Tolima",
  "VALLE DEL CAUCA": "Valle del Cauca",
  VAUPES: "Vaupés",
  VICHADA: "Vichada",
};

const FILTER_VARIANTS_BY_GEO: Record<string, string[]> = {
  "SANTAFE DE BOGOTA D.C": [
    "Distrito Capital de Bogotá",
    "Distrito Capital De Bogotá",
    "Bogotá",
    "Bogotá D.C.",
    "Bogota",
    "Bogota D.C.",
    "Santafe De Bogota D.C",
  ],
  "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA": [
    "San Andrés, Providencia y Santa Catalina",
    "San Andrés y Providencia",
    "San Andres, Providencia y Santa Catalina",
    "San Andres y Providencia",
    "San Andrés",
    "San Andres",
  ],
};

const GEO_NAME_BY_NORMALIZED_KEY = new Map(
  GEO_DEPARTMENT_NAMES.map((name) => [normalizeDepartmentKey(name), name]),
);

export function normalizeDepartmentKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function deptGeoName(value: string | null | undefined) {
  const normalized = normalizeDepartmentKey(value);
  if (!normalized) return "";

  const aliased = SPECIAL_GEO_ALIASES[normalized] ?? normalized;
  return GEO_NAME_BY_NORMALIZED_KEY.get(normalizeDepartmentKey(aliased))
    ?? GEO_NAME_BY_NORMALIZED_KEY.get(normalized)
    ?? aliased;
}

export function deptDisplayLabel(value: string | null | undefined) {
  const geoName = deptGeoName(value);
  if (!geoName) return "";
  return DISPLAY_LABELS[geoName] ?? geoName;
}

export function getAllGeoNames(): string[] {
  return [...GEO_DEPARTMENT_NAMES];
}

export function departmentFilterVariants(value: string | null | undefined) {
  const geoName = deptGeoName(value);
  if (!geoName) return [];

  return [...new Set([
    String(value ?? "").trim(),
    geoName,
    deptDisplayLabel(geoName),
    ...(FILTER_VARIANTS_BY_GEO[geoName] ?? []),
  ])].filter(Boolean);
}
