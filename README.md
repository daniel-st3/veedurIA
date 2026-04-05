# VeedurIA

**VeedurIA** es una capa cívica de lectura pública del poder en Colombia.

No intenta reemplazar la fuente oficial. La reorganiza para que periodistas, veedurías, ONG, academia y ciudadanía lleguen más rápido a tres preguntas:

1. ¿Qué contrato conviene abrir primero?
2. ¿Cómo votó un legislador frente a lo que prometía defender?
3. ¿Qué red de relaciones vale la pena seguir después?

La app vive hoy en: `https://veeduria.vercel.app`

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
Cruza votaciones nominales del Congreso con el perfil programático visible de cada legislador.

Incluye:
- grid de legisladores
- spotlight con métricas objetivas de coherencia
- tabla de votaciones filtrable
- matriz legislador × tema
- enlace a ContratoLimpio cuando hay contratos asociados

La coherencia visible se calcula a partir de votos, ausencias y posición pública por tema. No usa “similitud semántica” como métrica principal en la UI.

### 3. SigueElDinero
Es la siguiente capa del producto.

Hoy muestra:
- avance del módulo
- semilla de datos ya disponible
- vista previa del frente relacional
- roadmap de construcción

El objetivo final es conectar contratistas, donantes, funcionarios, votaciones y aprobaciones presupuestales dentro de una misma lectura.

## Arquitectura

El repo está dividido para mantener producto web y capa analítica sin mezclar responsabilidades:

- `web/`
  Next.js App Router. Aquí vive la interfaz pública, navegación, OG images, estilos y módulos.
- `backend/`
  FastAPI entrypoint para el frontend web.
- `src/`
  servicios Python, lectura de datos, scoring y lógica analítica.
- `data/`
  artefactos procesados, metadata del modelo y archivos de referencia.

## Rutas principales

- `/`
  landing del producto
- `/contrato-limpio`
  lectura de contratación pública
- `/votometro`
  seguimiento de votaciones legislativas
- `/promesmetro`
  redirect legado hacia `/votometro`
- `/promesometro`
  redirect legado hacia `/votometro`
- `/sigue-el-dinero`
  frente relacional en construcción
- `/etica-y-privacidad`
  privacidad, ética y límites de uso

## Stack

### Frontend
- Next.js 15
- React
- TypeScript
- GSAP
- Plotly / Recharts
- CSS global orientado a producto editorial

### Backend
- FastAPI
- pandas / pyarrow
- servicios Python de lectura y scoring

### Deploy
- GitHub como origen de verdad
- Vercel para `web/`
- despliegue automático desde `main`

## Cómo correrlo local

### Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Abrir:

```bash
http://localhost:3000
```

## Checks útiles

Frontend:

```bash
cd web
npm run build
```

Sanidad Python:

```bash
python3 -m py_compile backend/main.py src/api/contracts_service.py src/api/promises_service.py
```

## Datos y fallback

La experiencia web intenta consumir la API Python. Si esa API no está disponible, la app cae a un fallback mock para que el producto siga renderizando en Vercel.

Eso implica dos cosas:
- la UI nunca debe romperse por ausencia del backend
- cuando se trabaja sobre fallback, hay que dejar explícito qué es dato visible y qué sigue siendo cobertura piloto

## Archivos clave

| Path | Rol |
|---|---|
| `web/components/landing-page.tsx` | landing principal |
| `web/components/contracts-view.tsx` | ContratoLimpio |
| `web/components/contracts-dashboard.tsx` | gráficas del corte |
| `web/components/colombia-map.tsx` | mapa reusable de Colombia |
| `web/components/votometro-view.tsx` | módulo VotóMeter |
| `web/components/module-placeholder.tsx` | frente de SigueElDinero |
| `web/components/site-nav.tsx` | shell de navegación compartido |
| `web/components/site-footer.tsx` | footer compartido |
| `web/lib/api.ts` | capa fetch del frontend |
| `web/lib/mock-data.ts` | fallback mock del producto |
| `web/lib/votometro-data.ts` | dataset visible del módulo legislativo |
| `backend/main.py` | entrypoint FastAPI |
| `src/api/contracts_service.py` | payloads de contratos |
| `src/api/promises_service.py` | payloads Python heredados |

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

- Si haces push a `main`, Vercel despliega automáticamente.
- Si la UI en producción no refleja un cambio reciente, normalmente basta un hard refresh.
- Para contexto más detallado de arquitectura y flujo de trabajo, ver `CLAUDE.md`.
