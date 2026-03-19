#!/usr/bin/env python3
"""
Config environment check — verifies which secrets are set.

Prints ONLY key names and True/False status. Never prints values.

Usage:
    python dev/check_config_env.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Load .env before checking
from dotenv import load_dotenv
load_dotenv(project_root / ".env")


REQUIRED_KEYS = [
    "SOCRATA_APP_TOKEN",
    "SOCRATA_CLIENT_ID",
    "SOCRATA_CLIENT_SECRET",
    "SOCRATA_APP_SECRET",
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "SUPABASE_STORAGE_BUCKET",
]


def main() -> None:
    print("=" * 50)
    print("VeedurIA — Config Environment Check")
    print("=" * 50)
    print()

    all_present = True
    for key in REQUIRED_KEYS:
        value = os.getenv(key)
        present = value is not None and len(value.strip()) > 0
        status = "✅ SET" if present else "❌ MISSING"
        print(f"  {key:35s} {status}")
        if not present:
            all_present = False

    print()
    if all_present:
        print("✅ All required keys are configured.")
    else:
        print("❌ Some keys are missing. Copy .env.example to .env and fill in values.")
        print("   See: .env.example")

    print()
    print("Note: This script checks os.getenv only (not st.secrets).")
    print("      Streamlit Cloud secrets are verified at runtime.")


if __name__ == "__main__":
    main()
