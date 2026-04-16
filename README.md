# VeedurIA

**VeedurIA** es una capa cívica de lectura pública del poder en Colombia.

No intenta reemplazar la fuente oficial. La reorganiza para que periodistas, veedurías, ONG, academia y ciudadanía lleguen más rápido a tres preguntas:

1. ¿Qué contrato conviene abrir primero?
2. ¿Cómo votó un legislador frente a lo que prometía defender?
3. ¿Qué red de relaciones vale la pena seguir después?

La app vive hoy en: `https://veeduria.vercel.app`

## Tabla de contenidos

- [Qué incluye hoy](#qué-incluye-hoy)
- [Arquitectura del repo](#arquitectura-del-repo)
- [VotóMeter](#votómeter)
- [Desarrollo local](#desarrollo-local)
- [Base de datos y bootstrap](#base-de-datos-y-bootstrap)
- [Variables de entorno](#variables-de-entorno)
- [Ingesta y sincronización](#ingesta-y-sincronización)
- [Backoffice de revisión](#backoffice-de-revisión)
- [Pruebas y verificación](#pruebas-y-verificación)
- [Deploy de staging / producción](#deploy-de-staging--producción)
- [Datos y fallback](#datos-y-fallback)
- [Archivos clave](#archivos-clave)
- [Limitaciones / TODO](#limitaciones--todo)

## Qué incluye hoy

### 1. ContratoLimpio

Lee contratación pública, permite filtrar el corte visible y ordena qué revisar primero.

Incluye:

- filtros por texto, territorio, riesgo, modalidad y fechas
- mapa de riesgo por departamento
- caso principal con factores explicativos
- comparativos del mismo corte
- explorador y sandbox exportable
- salto directo al expediente oficial en SECOP II

El puntaje es una **señal de prioridad**, no una acusación.

### 2. VotóMeter

Directorio vivo de legisladores con roster, votos, asistencia y coherencia pública solo donde haya promesas revisadas.

Incluye:

- directorio SSR con filtros por URL y paginación server-side
- perfiles individuales por legislador
- API pública desde Next.js sobre Supabase
- backoffice mínimo para revisar promesas y colisiones de identidad
- sincronización automática desde datos.gov.co y Senado abierto

La coherencia visible solo aparece cuando existe una promesa revisada en backoffice.

### 3. SigueElDinero

Es la siguiente capa del producto.

Hoy muestra:

- avance del módulo
- semilla de datos ya disponible
- vista previa del frente relacional
- roadmap de construcción

El objetivo final es conectar contratistas, donantes, funcionarios, votaciones y aprobaciones presupuestales dentro de una misma lectura.

## Arquitectura del repo

El repo está dividido para mantener producto web y capa analítica sin mezclar responsabilidades:

- `web/`
  Next.js App Router. Aquí vive la interfaz pública, navegación, OG images, estilos y módulos.
- `backend/`
  FastAPI entrypoint para el frontend web.
- `src/`
  servicios Python, lectura de datos, scoring y lógica analítica.
- `scripts/`
  bootstrap SQL y scripts operativos.
- `data/`
  artefactos procesados, metadata del modelo y archivos de referencia.

## VotóMeter

### Qué hace

VotóMeter es el módulo legislativo de VeedurIA. En su MVP actual:

- usa **Supabase** como fuente pública de datos en producción
- sirve el directorio principal desde `/votometro`
- sirve perfiles individuales desde `/votometro/legislador/[slug]`
- expone API pública bajo `/api/votometro/*`
- mantiene un panel interno mínimo en `/votometro/review`

### Arquitectura de VotóMeter

- **Esquema y storage**
  El bootstrap está en `scripts/setup_supabase.sql`. Ahí se crean las tablas de VotóMeter, vistas públicas y el bucket `votometro-source-snapshots`.
- **Capa server-side**
  La lógica de lectura, filtros, DTOs y composición SSR vive en `web/lib/votometro-server.ts`.
- **Rutas públicas**
  La UI SSR vive en `web/app/votometro/page.tsx` y `web/app/votometro/legislador/[slug]/page.tsx`.
- **API pública**
  Los route handlers viven en `web/app/api/votometro/`.
- **Review / backoffice**
  La UI está en `web/app/votometro/review/page.tsx` y la autenticación ligera se apoya en `web/lib/votometro-admin.ts`.
- **Ingesta**
  Los adapters y el sync están en `src/ingestion/votometro/`.
- **Orquestación**
  La sincronización programada se define en `.github/workflows/votometro_sync.yml`.

### Rutas y endpoints

UI:

- `/votometro`
- `/votometro/legislador/[slug]`
- `/votometro/review`

API pública:

- `GET /api/votometro/legislators`
- `GET /api/votometro/legislators/[slug]`
- `GET /api/votometro/votes`
- `GET /api/votometro/parties`
- `GET /api/votometro/topics`

Handlers internos de review:

- `POST /api/votometro/review/login`
- `POST /api/votometro/review/logout`
- `POST /api/votometro/review/promises/[id]`
- `POST /api/votometro/review/conflicts/[id]`

## Desarrollo local

### Prerrequisitos

- Python 3.11+
- Node.js 20+
- un proyecto Supabase accesible

### 1. Instalar dependencias

Backend / scripts Python:

```bash
pip install -r requirements.txt
```

Frontend:

```bash
cd web
npm install
cd ..
```

### 2. Levantar el backend Python

No es obligatorio para el directorio SSR de VotóMeter, pero sigue siendo útil para módulos heredados y servicios Python.

Desde la raíz del repo:

```bash
uvicorn backend.main:app --reload --port 8000
```

O usando el script del repo:

```bash
npm run dev:api
```

### 3. Levantar el frontend

Desde la raíz del repo:

```bash
cd web
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 \
npm run dev
```

O usando el script del repo:

```bash
npm run dev:web
```

Abrir:

```bash
http://localhost:3000
```

### 4. Preparar VotóMeter localmente

Antes de esperar datos reales en `/votometro`:

1. Ejecuta `scripts/setup_supabase.sql` en tu proyecto Supabase local, staging o dev.
2. Define las variables de entorno de Supabase indicadas abajo.
3. Corre un sync manual:

```bash
python scripts/sync_votometro.py --mode=daily
```

También puedes llamar el módulo directamente:

```bash
python -m src.ingestion.votometro.sync --mode=daily
```

## Base de datos y bootstrap

VotóMeter **no** se considera listo para producción hasta que el esquema SQL haya sido aplicado en el proyecto Supabase destino.

### Bootstrap inicial

1. Abre el SQL Editor del proyecto Supabase de staging o producción.
2. Ejecuta por completo:

```sql
scripts/setup_supabase.sql
```

3. Verifica que queden creadas:

- tablas de VotóMeter como `legislators`, `legislator_terms`, `projects`, `vote_events`, `vote_records`, `attendance_records`, `legislator_metrics_current`, `party_metrics_current`, `promise_claims`, `promise_reviews`, `promise_vote_matches`, `identity_conflicts`, `ingestion_runs`
- vistas públicas como `votometro_directory_public`, `votometro_vote_records_public` y `votometro_approved_promises_public`
- bucket de storage `votometro-source-snapshots`

### Migraciones

Hoy no hay un sistema separado de migraciones para VotóMeter. El contrato operativo es:

- editar `scripts/setup_supabase.sql`
- aplicar el cambio explícitamente en Supabase
- sincronizar staging antes de producción

Si cambias el schema, documenta ese cambio en el PR y vuelve a correr los checks de build/tests.

## Variables de entorno

Las variables más relevantes para operar VotóMeter son:

| Variable | Dónde aplica | Obligatoria | Uso |
|---|---|---:|---|
| `SUPABASE_URL` | frontend, backend, sync, CI | Sí | URL base del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Next.js público | Sí para `/api/votometro/*` y lecturas públicas | la usa `createServerSupabase()` para lecturas con RLS |
| `SUPABASE_SERVICE_KEY` | Next.js server-side / admin | Sí en staging/prod | la usa `createServiceSupabase()` para review y operaciones internas |
| `SUPABASE_KEY` | sync jobs, fallback server-side, scripts Python | Sí hoy para sync/CI | el pipeline Python y algunos fallbacks lo siguen usando; también es fallback del service client |
| `VOTOMETRO_REVIEW_PASSWORD` | frontend | Sí si vas a usar `/votometro/review` | password del panel de revisión |
| `SOCRATA_APP_TOKEN` | sync jobs | Recomendado | mejora cuota/estabilidad al leer Cámara desde datos.gov.co |
| `VOTOMETRO_STORAGE_BUCKET` | sync jobs | Opcional | bucket para snapshots raw; si no existe, usa `votometro-source-snapshots` |
| `NEXT_PUBLIC_APP_URL` | frontend | Recomendado | base URL usada por fetches server-side al llamar route handlers internos |
| `NEXT_PUBLIC_SITE_URL` | frontend | Recomendado | canonical URLs y metadata |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Opcional para VotóMeter, útil para módulos heredados | base del backend FastAPI |

Notas importantes:

- El prompt de despliegue debe tratar `SUPABASE_SERVICE_KEY` como la credencial correcta para server-side / admin.
- En el código actual, `SUPABASE_KEY` sigue siendo una variable operativa real para scripts Python y como fallback del service client.
- Si más adelante introduces acceso browser-side directo a Supabase, documenta explícitamente si se apoya en `SUPABASE_ANON_KEY` o en otra convención. Hoy las rutas públicas de VotóMeter pasan por Next.js.

## Ingesta y sincronización

### Fuentes actuales

El sync del MVP usa estas fuentes:

- **Cámara**
  `datos.gov.co` vía SODA / Socrata
- **Senado**
  `https://app.senado.gov.co/open_data/`
- **Backfill semanal**
  gancho preparado para Cámara / Congreso Visible, todavía incompleto

### Qué hace el sync

`src/ingestion/votometro/sync.py`:

- descarga el roster visible de Cámara y Senado
- normaliza nombres y slugs
- calcula votos y asistencia del Senado abierto
- calcula agregados por legislador y por partido
- sube snapshots raw a Supabase Storage
- registra corridas en `ingestion_runs`
- **no reemplaza** la capa pública si detecta una caída de cobertura mayor al 10%

### Cómo correrlo manualmente

Sync diario:

```bash
python scripts/sync_votometro.py --mode=daily
```

Sync semanal:

```bash
python scripts/sync_votometro.py --mode=weekly
```

También sirve:

```bash
python -m src.ingestion.votometro.sync --mode=daily
python -m src.ingestion.votometro.sync --mode=weekly
```

### Workflow de GitHub Actions

Archivo:

```text
.github/workflows/votometro_sync.yml
```

Comportamiento actual:

- cron diario: `30 5 * * *`
- cron semanal: `0 6 * * 0`
- `workflow_dispatch` con `mode=daily|weekly`
- instala `requirements-phase1.txt`
- ejecuta `python -m src.ingestion.votometro.sync --mode=...`

Secrets mínimos que deben existir en GitHub Actions:

- `SUPABASE_URL`
- `SUPABASE_KEY`

Secret recomendado:

- `SOCRATA_APP_TOKEN`

Antes de activar el workflow en staging o producción, confirma:

- que el cron programado es el que realmente quieres operar
- que las secrets están cargadas
- que `setup_supabase.sql` ya corrió en el proyecto Supabase destino

## Backoffice de revisión

Ruta:

```text
/votometro/review
```

Cómo funciona:

- el acceso se habilita cuando existe `VOTOMETRO_REVIEW_PASSWORD`
- el login genera una cookie HTTP-only llamada `votometro_review`
- la sesión se usa para aprobar/rechazar promesas y resolver colisiones de identidad

Uso mínimo:

1. define `VOTOMETRO_REVIEW_PASSWORD`
2. despliega el frontend con `SUPABASE_SERVICE_KEY`
3. abre `/votometro/review`
4. ingresa el password
5. revisa:
   - promesas pendientes
   - colisiones de identidad
   - corridas recientes de sync

Importante:

- sin `VOTOMETRO_REVIEW_PASSWORD`, el panel se renderiza pero queda deshabilitado
- sin `SUPABASE_SERVICE_KEY` o `SUPABASE_KEY`, las operaciones internas no podrán escribir

## Pruebas y verificación

### Tests de VotóMeter

Desde la raíz del repo:

```bash
pytest tests/test_votometro_adapters.py
```

Cubren:

- normalización
- adapters de Cámara y Senado
- métricas y agregados

### Build del frontend

Desde `web/`:

```bash
npm run build
```

Este build debe pasar antes de mover cambios de VotóMeter a staging o producción.

### Check rápido recomendado antes de deploy

```bash
pytest tests/test_votometro_adapters.py
cd web && npm run build
```

## Deploy de staging / producción

Checklist recomendado:

1. Ejecutar `scripts/setup_supabase.sql` en el proyecto Supabase destino.
2. Configurar en el frontend:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `VOTOMETRO_REVIEW_PASSWORD`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SITE_URL`
3. Configurar en GitHub Actions:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SOCRATA_APP_TOKEN` si vas a consumir Cámara con cuota estable
4. Verificar que `.github/workflows/votometro_sync.yml` tenga el cron correcto y no esté deshabilitado.
5. Lanzar un `workflow_dispatch` manual en modo `daily` después del bootstrap.
6. Verificar en la app desplegada:
   - `/votometro`
   - `/votometro/legislador/[slug]`
   - `/api/votometro/legislators`
   - `/votometro/review`
7. Confirmar que `ingestion_runs` registre la corrida y que no quede en `warning` por caída de cobertura.

## Datos y fallback

La experiencia web histórica intenta consumir la API Python y, si no está disponible, puede caer a mocks en algunos módulos heredados.

Para VotóMeter, el objetivo operativo del MVP es otro:

- **producción**: Supabase + route handlers de Next.js
- **no** el dataset estático anterior

Si `/votometro` aparece vacío en un entorno nuevo, normalmente la causa no es el frontend:

- falta correr `setup_supabase.sql`
- faltan variables de entorno de Supabase
- el sync todavía no ha corrido
- el sync quedó en `warning` y no reemplazó la capa pública

## Archivos clave

| Path | Rol |
|---|---|
| `scripts/setup_supabase.sql` | bootstrap de tablas, vistas públicas y bucket de snapshots |
| `scripts/sync_votometro.py` | wrapper CLI para correr el sync |
| `src/ingestion/votometro/camera_adapter.py` | ingestión de Cámara desde datos.gov.co |
| `src/ingestion/votometro/senate_adapter.py` | ingestión de Senado abierto |
| `src/ingestion/votometro/congreso_visible.py` | gancho de backfill semanal, hoy incompleto |
| `src/ingestion/votometro/sync.py` | orquestación principal del sync y guardrail de cobertura |
| `web/lib/votometro-server.ts` | queries, DTOs y filtros server-side de VotóMeter |
| `web/lib/votometro-admin.ts` | auth ligera del review panel |
| `web/app/votometro/page.tsx` | directorio SSR |
| `web/app/votometro/legislador/[slug]/page.tsx` | perfil individual SSR |
| `web/app/votometro/review/page.tsx` | panel interno de revisión |
| `web/app/api/votometro/` | API pública e interna de VotóMeter |
| `.github/workflows/votometro_sync.yml` | cron y workflow de sincronización |
| `tests/test_votometro_adapters.py` | cobertura de normalización, adapters y métricas |

## Limitaciones / TODO

Limitaciones conocidas del MVP:

- El backfill de **Cámara / Congreso Visible** está **intencionalmente incompleto**.
- El gancho semanal existe y se ejecuta, pero hoy devuelve un **warning controlado** en vez de correr un scraper completo.
- La coherencia pública solo aparece cuando hay promesas revisadas en backoffice.
- El módulo todavía no hace un backfill histórico completo de proyectos y votaciones de Cámara.

Qué hacer después:

- completar el scraper / ingestión real de Congreso Visible para Cámara e histórico
- enriquecer proyectos de ley y relaciones promesa → voto
- endurecer observabilidad de los syncs
- agregar documentación de migraciones incrementales si el schema deja de vivir solo en `setup_supabase.sql`

## Principios del producto

- fuente primero
- explicación antes que jerga
- una sola lectura, no diez pantallas
- contraste entre dato oficial, scoring y evidencia visible
- diseño sobrio, no dashboard genérico

## Estado actual

VeedurIA ya no es solo una prueba visual. Hoy funciona como un producto web con navegación compartida, módulos activos y una ruta clara de expansión:

- ContratoLimpio ya sirve como frente operativo
- VotóMeter ya reemplazó al módulo anterior de promesas
- SigueElDinero ya muestra avance real y no una pantalla vacía

## Notas

- Si haces push a `main`, Vercel despliega automáticamente el frontend.
- Si la UI en producción no refleja un cambio reciente, normalmente basta un hard refresh.
- Para contexto más detallado de arquitectura y flujo de trabajo, ver `CLAUDE.md`.
