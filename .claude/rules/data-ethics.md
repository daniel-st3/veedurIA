# Data Ethics Rules — VeedurIA

These rules are mandatory for all code, UI, and data handling in this project.
They cannot be overridden by sprint goals or performance considerations.

---

## 1. Institutional Level Only

- Operate at the **institution level**: ministerios, gobernaciones, alcaldías, entidades públicas.
- **Never** flag specific individuals by name in any UI output, chart title, or generated text.
- When a person's name is technically available in the source data (e.g., contratista persona
  natural), aggregate or anonymize before display unless the source (SECOP, Cuentas Claras)
  makes the full record unambiguously public and the name is the primary identifier of the
  contracting entity (i.e., a registered business name that is a person's name).

## 2. Show Aggregates First

- Default views must show **aggregate** risk indicators at department or entity level.
- Drill-down to individual contract level is allowed only when the user explicitly requests it.
- Never auto-surface individual contract details as the primary landing view.

## 3. Mandatory Ethical Disclaimer

Every alert card, risk indicator, or flagged record displayed in the UI **must** include
the following disclaimer in the active language:

**Spanish (ES):**
> "Esta es una alerta preventiva generada automáticamente. No constituye prueba de
> irregularidad. Consulte los documentos del proceso antes de concluir."

**English (EN):**
> "This is an automatically generated preventive alert. It does not constitute evidence
> of wrongdoing. Review source documents before drawing conclusions."

This text must be rendered visibly — not hidden behind a toggle or collapsed by default.

## 4. Methodology Transparency Tab

Every page that shows ML-derived results **must** include a visible "Metodología" tab or
expandable section that explains:
- Which model was used and its parameters
- Which features were used as inputs
- Known limitations of the model
- Estimated false positive rate (from validation results)
- Date the model was last trained
- Link to the source data

This tab must be available without login or any user action beyond clicking it.

## 5. No Individual Name Filtering in Public UI

- **Never** build a filter, search field, or query parameter that allows the public UI
  to return results filtered by an individual person's name.
- NIT-based search for legal entities (empresas) is allowed.
- Name-based search for natural persons is not allowed in the main public interface.
- If such a feature is needed for internal audit tools, it must be behind authentication
  and must not be accessible from the public Streamlit deployment.

## 6. Language Precision

- Use precise, measured language in all automated outputs.
- Prohibited terms in any language: "confirmed corruption", "fraud", "illegal",
  "corrupción confirmada", "fraude", "ilegal".
- Required alternatives: "anomalía detectada", "patrón atípico", "bandera de riesgo",
  "alerta preventiva", "detected anomaly", "atypical pattern", "risk flag",
  "preventive alert".

## 7. Data Minimization

- Only fetch and store fields from SECOP/Cuentas Claras that are directly used as
  ML features or displayed in the UI.
- Do not build a shadow database of personal data beyond what is minimally necessary.
- `/data/raw/` is gitignored for a reason: raw pulls may contain fields not yet
  reviewed for necessity. Only promote to `/data/processed/` after field selection.
