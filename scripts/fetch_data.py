"""Download real Elexon data with bounded retries and atomic snapshot writes.

Run from the repository root: python scripts/fetch_data.py
The forecast publication window starts early to allow prior-day fallback.
"""

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets/"
ROOT = Path(__file__).resolve().parents[1] / "data"


def fetch(dataset, params):
    url = BASE + dataset + "/stream?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Windward-assignment/1.0",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.load(response)
            records = payload if isinstance(payload, list) else payload["data"]
            if not isinstance(records, list):
                raise ValueError("Unexpected Elexon response shape")
            return records, url
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def main():
    ROOT.mkdir(exist_ok=True)
    tasks = []
    day = date(2025, 12, 30)
    while day <= date(2026, 1, 31):
        tasks.append(
            (
                "WINDFOR",
                {
                    "publishDateTimeFrom": day.isoformat() + "T00:00:00Z",
                    "publishDateTimeTo": (day + timedelta(days=1)).isoformat()
                    + "T00:00:00Z",
                },
            )
        )
        day += timedelta(days=1)
    day = date(2026, 1, 2)
    while day <= date(2026, 2, 1):
        tasks.append(
            (
                "FUELHH",
                {
                    "settlementDateFrom": day.isoformat(),
                    "settlementDateTo": day.isoformat(),
                    "fuelType": "WIND",
                },
            )
        )
        day += timedelta(days=1)
    datasets = {"WINDFOR": {}, "FUELHH": {}}
    urls = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = pool.map(lambda task: fetch(*task), tasks)
        for (dataset, _), (records, url) in zip(tasks, responses):
            urls.append(url)
            for record in records:
                if dataset == "FUELHH" and record.get("fuelType") != "WIND":
                    continue
                # Endpoint date boundaries may overlap; deduplicate exact versions.
                key = (
                    record["startTime"],
                    record["publishTime"],
                    record.get("fuelType"),
                )
                datasets[dataset][key] = record
            print(dataset, len(records), url, flush=True)
    hashes = {}
    for dataset, filename in (
        ("WINDFOR", "forecasts.json"),
        ("FUELHH", "actuals.json"),
    ):
        records = sorted(
            datasets[dataset].values(), key=lambda r: (r["startTime"], r["publishTime"])
        )
        if not records:
            raise ValueError("Refusing to save an empty dataset: " + dataset)
        encoded = json.dumps(records, separators=(",", ":"))
        temporary = ROOT / (filename + ".tmp")
        temporary.write_text(encoded, encoding="utf-8")
        temporary.replace(ROOT / filename)
        hashes[filename] = hashlib.sha256(encoded.encode()).hexdigest()
    provenance = {
        "source": "Elexon Insights Solution",
        "synthetic": False,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "urls": urls,
        "sha256": hashes,
        "counts": {k: len(v) for k, v in datasets.items()},
    }
    (ROOT / "provenance.json").write_text(
        json.dumps(provenance, indent=2), encoding="utf-8"
    )
    print("Snapshot saved", provenance["counts"])


if __name__ == "__main__":
    main()
