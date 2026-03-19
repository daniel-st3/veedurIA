# Colombia Departments GeoJSON — Source & Processing Notes

## Source

- **Original**: [john-guerra/Colombia.geo.json](https://gist.github.com/john-guerra/43c7656821069d00dcbc)
- **Upstream data**: DANE (Departamento Administrativo Nacional de Estadística) open shapefiles
- **License**: Public domain — Colombian government geographic data. DANE shapefiles are freely
  redistributable per Ley 1712 de 2014 (Ley de Transparencia).

## Processing

The original file was 1.4 MB with very detailed coordinate geometries. We applied:

1. **Douglas-Peucker simplification**
   - Tolerance: 0.008° (~0.9 km at equator) for all departments
   - Tolerance: 0.02° for San Andrés y Providencia archipelago (heavily detailed island coastlines)

2. **Coordinate rounding**: All coordinates rounded to 4 decimal places (~11m precision at equator)

3. **Property stripping**: Removed `AREA`, `PERIMETER`, `HECTARES` — kept only `NOMBRE_DPT` and `DPTO`

4. **CRS removal**: Stripped the non-standard `crs` property (GeoJSON RFC 7946 uses WGS 84 by default)

5. **Compact JSON**: Written with `separators=(',', ':')` to minimize whitespace

## Result

| Metric | Value |
|--------|-------|
| File size | ~91 KB |
| Features | 33 (32 departments + Bogotá D.C.) |
| Geometry types | Polygon, MultiPolygon |
| Properties | `NOMBRE_DPT` (uppercase department name), `DPTO` (2-digit DANE code) |

## Department Names (NOMBRE_DPT values)

```
AMAZONAS
ANTIOQUIA
ARAUCA
ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA
ATLANTICO
BOLIVAR
BOYACA
CALDAS
CAQUETA
CASANARE
CAUCA
CESAR
CHOCO
CORDOBA
CUNDINAMARCA
GUAINIA
GUAVIARE
HUILA
LA GUAJIRA
MAGDALENA
META
NARIÑO
NORTE DE SANTANDER
PUTUMAYO
QUINDIO
RISARALDA
SANTAFE DE BOGOTA D.C
SANTANDER
SUCRE
TOLIMA
VALLE DEL CAUCA
VAUPES
VICHADA
```

## Known Name Mismatches with SECOP Data

SECOP uses different naming conventions. The normalization mapping in
`src/ui/maps.py` handles these:

| SECOP variant | GeoJSON NOMBRE_DPT |
|---|---|
| Bogotá, Bogotá D.C., Bogota D.C. | SANTAFE DE BOGOTA D.C |
| San Andrés, San Andrés y Providencia | ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA |
| Nariño (with accent) | NARIÑO (preserved — Ñ is kept) |
| La Guajira, Guajira | LA GUAJIRA |
| Norte Santander | NORTE DE SANTANDER |
