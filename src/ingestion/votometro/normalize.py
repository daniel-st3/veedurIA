from __future__ import annotations

import hashlib
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable

TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "salud": ("salud", "eps", "hospital", "medic"),
    "paz": ("paz", "victima", "reconcili", "conflicto"),
    "justicia": ("justicia", "judicial", "fiscal", "penal", "carcel"),
    "pensiones": ("pension", "colpensiones", "jubil"),
    "economia": ("econom", "tribut", "impuesto", "hacienda", "financ"),
    "ambiente": ("ambient", "fracking", "deforest", "clima", "agua"),
    "presupuesto": ("presupuesto", "apropiacion", "gasto", "fiscal"),
    "derechos": ("derechos", "igualdad", "mujer", "etnic", "diversidad"),
    "energia": ("energia", "electr", "hidrogeno", "gas", "petrol"),
    "anticorrupcion": ("corrupcion", "transparencia", "soborno", "etica"),
    "educacion": ("educacion", "escuela", "universidad", "docente"),
    "seguridad": ("seguridad", "policia", "defensa", "convivencia"),
}

TOPIC_LABELS = {
    "salud": "Salud",
    "paz": "Paz",
    "justicia": "Justicia",
    "pensiones": "Pensiones",
    "economia": "Economía",
    "ambiente": "Ambiente",
    "presupuesto": "Presupuesto",
    "derechos": "Derechos",
    "energia": "Energía",
    "anticorrupcion": "Anticorrupción",
    "educacion": "Educación",
    "seguridad": "Seguridad",
    "sin-clasificar": "Sin clasificar",
}


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().lower()
    return re.sub(r"\s+", " ", text)


def slugify(value: str | None) -> str:
    normalized = normalize_text(value).replace(" ", "-")
    return normalized or "sin-nombre"


def build_initials(value: str | None) -> str:
    words = [word[0].upper() for word in normalize_text(value).split()[:2] if word]
    return "".join(words) or "NN"


def party_key(chamber: str, party: str | None) -> str:
    base = slugify(party or "sin-partido")
    return f"{chamber}:{base}"


def legislator_id(chamber: str, name: str | None, period_key: str = "2022-2026") -> str:
    return f"leg:{chamber}:{slugify(name)}:{period_key}"


def stable_id(prefix: str, *parts: str | None) -> str:
    clean = "|".join(normalize_text(part) for part in parts if part)
    digest = hashlib.sha1(clean.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}:{digest}"


def match_score(left: str | None, right: str | None) -> float:
    return SequenceMatcher(None, normalize_text(left), normalize_text(right)).ratio()


def find_best_name_match(
    candidate_name: str,
    options: Iterable[dict],
    *,
    chamber: str | None = None,
    party: str | None = None,
    threshold: float = 0.92,
) -> dict | None:
    best: tuple[float, dict] | None = None
    for option in options:
        if chamber and option.get("chamber") != chamber:
            continue
        if party and option.get("party") and normalize_text(option.get("party")) != normalize_text(party):
            continue
        score = match_score(candidate_name, option.get("canonical_name") or option.get("name"))
        if best is None or score > best[0]:
            best = (score, option)
    if best is None or best[0] < threshold:
        return None
    return best[1]


def classify_topic(title: str | None) -> str:
    normalized = normalize_text(title)
    for key, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return key
    return "sin-clasificar"


def topic_label(topic_key: str | None) -> str:
    return TOPIC_LABELS.get(topic_key or "sin-clasificar", "Sin clasificar")
