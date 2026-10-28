"""Read the bundled, reproducible Elexon snapshot (no synthetic fallback)."""

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@lru_cache(maxsize=1)
def load_snapshot():
    paths = [
        DATA_DIR / name
        for name in ("forecasts.json", "actuals.json", "provenance.json")
    ]
    if not all(path.exists() for path in paths):
        raise FileNotFoundError(
            "Snapshot missing. Run python scripts/fetch_data.py first."
        )
    return tuple(json.loads(path.read_text(encoding="utf-8")) for path in paths)
