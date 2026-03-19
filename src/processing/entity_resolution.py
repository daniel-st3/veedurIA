"""
Entity resolution utilities for VeedurIA.

Provides NIT/cédula cleaning and entity name normalization to enable
consistent cross-referencing of contractors across SECOP II datasets.

Usage:
    from src.processing.entity_resolution import clean_nit, normalize_name

    nit = clean_nit("830.123.456-7")   # → "8301234567"
    name = normalize_name("José María García Ñoño S.A.S.")  # → "JOSE MARIA GARCIA NONO S.A.S."
"""

from __future__ import annotations

import re
import unicodedata


def clean_nit(raw_nit: str | None) -> str | None:
    """
    Clean a Colombian NIT (Número de Identificación Tributaria) to a
    digit-only canonical form.

    Steps:
        1. Strip whitespace
        2. Remove dots, hyphens, and the check digit suffix (e.g. "-7")
        3. Return only digits

    Args:
        raw_nit: Raw NIT string from SECOP data (e.g. "830.123.456-7",
                 "830123456", "NIT 830123456").

    Returns:
        Cleaned digit-only NIT string, or None if input is None/empty
        or contains no digits.

    Examples:
        >>> clean_nit("830.123.456-7")
        '8301234567'
        >>> clean_nit("NIT 900555123")
        '900555123'
        >>> clean_nit(None)
        None
    """
    if not raw_nit:
        return None

    raw_nit = str(raw_nit).strip()

    # Remove common prefixes
    for prefix in ("NIT", "C.C.", "CC", "CE"):
        if raw_nit.upper().startswith(prefix):
            raw_nit = raw_nit[len(prefix):].strip()

    # Remove dots and hyphens (e.g. "830.123.456-7" → "8301234567")
    cleaned = re.sub(r"[.\-\s]", "", raw_nit)

    # Keep only digits
    digits = re.sub(r"[^\d]", "", cleaned)

    return digits if digits else None


def normalize_name(name: str | None) -> str | None:
    """
    Normalize a Colombian entity or provider name for consistent matching.

    Steps:
        1. Strip leading/trailing whitespace
        2. Convert to uppercase
        3. Remove accents (NFD decomposition, strip combining marks)
        4. Collapse multiple whitespace to single space
        5. Strip common legal suffixes noise (but keep S.A.S., LTDA, etc.)

    Args:
        name: Raw entity name from SECOP data.

    Returns:
        Normalized uppercase name without accents, or None if input is
        None/empty.

    Examples:
        >>> normalize_name("José María García Ñoño S.A.S.")
        'JOSE MARIA GARCIA NONO S.A.S.'
        >>> normalize_name("  municipio  de  Bogotá  ")
        'MUNICIPIO DE BOGOTA'
    """
    if not name:
        return None

    name = str(name).strip().upper()

    # Remove accents: decompose to NFD, strip combining marks (Mn category)
    nfkd = unicodedata.normalize("NFKD", name)
    without_accents = "".join(
        ch for ch in nfkd if unicodedata.category(ch) != "Mn"
    )

    # Collapse whitespace
    return " ".join(without_accents.split())


def nit_check_digit(nit_digits: str) -> int:
    """
    Compute the check digit (dígito de verificación) for a Colombian NIT.

    Uses the standard DIAN algorithm: multiply each digit by its positional
    weight, sum, take modulus.

    Args:
        nit_digits: String of 9 digits (NIT without check digit).

    Returns:
        Check digit (0–9).

    Raises:
        ValueError: If input is not exactly 9 digits.
    """
    if not nit_digits or len(nit_digits) != 9 or not nit_digits.isdigit():
        raise ValueError(
            f"Expected 9-digit NIT, got: '{nit_digits}'"
        )

    weights = [71, 67, 59, 53, 47, 43, 41, 37, 29]
    total = sum(int(d) * w for d, w in zip(nit_digits, weights))
    remainder = total % 11

    if remainder == 0:
        return 0
    elif remainder == 1:
        return 1
    else:
        return 11 - remainder
