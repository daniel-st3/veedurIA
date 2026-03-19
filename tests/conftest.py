"""
Shared test fixtures for VeedurIA test suite.

Provides reusable fixtures across all test modules. Loaded automatically
by pytest from tests/conftest.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def sample_contracts_df() -> pd.DataFrame:
    """Create a realistic SECOP II contracts DataFrame for testing."""
    rng = np.random.default_rng(42)
    n = 100

    modalidades = [
        "Contratación Directa",
        "Licitación Pública",
        "Selección Abreviada",
        "Mínima Cuantía",
    ]

    return pd.DataFrame({
        "id_contrato": [f"CO-{i:06d}" for i in range(n)],
        "nit_entidad": rng.choice(["839000737", "890805765", "800141955"], n),
        "nombre_entidad": rng.choice(["UNGRD", "Municipio de Manizales", "Cancillería"], n),
        "nit_proveedor": rng.choice([f"PROV-{j:04d}" for j in range(15)], n),
        "proveedor_adjudicado": rng.choice(["Proveedor A SAS", "Proveedor B LTDA"], n),
        "valor_contrato": rng.lognormal(mean=20, sigma=2, size=n).astype(str),
        "valor_contrato_con_adiciones": rng.lognormal(mean=20, sigma=2, size=n).astype(str),
        "valor_de_pago_adelantado": (rng.random(n) * 1e8).astype(str),
        "numero_de_ofertantes": rng.choice(["1", "2", "3", "5", None], n),
        "modalidad_de_contratacion": rng.choice(modalidades, n),
        "fecha_firma": pd.date_range("2024-01-01", periods=n, freq="D", tz="UTC").astype(str),
        "fecha_de_fin_del_contrato": pd.date_range("2024-06-01", periods=n, freq="D", tz="UTC").astype(str),
        "fecha_publicacion_proceso": pd.date_range("2023-12-01", periods=n, freq="D", tz="UTC").astype(str),
        "objeto_del_contrato": rng.choice(["Servicio", "Suministro", "Obra"], n),
        "codigo_unspsc": rng.choice(["43211500", "80111600"], n),
        "departamento": rng.choice(["Bogotá", "Antioquia", "Valle del Cauca"], n),
    })


@pytest.fixture
def i18n_dir() -> Path:
    """Path to the i18n directory."""
    return PROJECT_ROOT / "i18n"


@pytest.fixture
def es_translations(i18n_dir: Path) -> dict:
    """Load Spanish translations."""
    with open(i18n_dir / "es.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def en_translations(i18n_dir: Path) -> dict:
    """Load English translations."""
    with open(i18n_dir / "en.json", "r", encoding="utf-8") as f:
        return json.load(f)
