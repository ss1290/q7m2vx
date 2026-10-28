"""FastAPI service shared by Docker, local development, and Vercel."""

import csv
import io
from pathlib import Path
from datetime import date, time
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from backend.analysis import analyse
from backend.data import load_snapshot

app = FastAPI(title="Windward | Day-ahead wind intelligence", version="1.0.0")


def validate(start, end, cutoff):
    try:
        first, last = date.fromisoformat(start), date.fromisoformat(end)
        time.fromisoformat(cutoff)
        if len(cutoff) != 5 or cutoff[2] != ":":
            raise ValueError("Use HH:MM")
    except ValueError:
        raise HTTPException(422, "Use ISO dates and a cutoff in HH:MM format.")
    if not date(2026, 1, 1) <= first <= last <= date(2026, 1, 31):
        raise HTTPException(
            422, "Decision dates must be ordered and within January 2026."
        )


@lru_cache(maxsize=128)
def result(start, end, cutoff):
    try:
        forecasts, actuals, provenance = load_snapshot()
    except FileNotFoundError as exc:
        raise HTTPException(503, str(exc))
    return dict(
        **analyse(forecasts, actuals, start, end, cutoff),
        provenance=provenance,
        parameters=dict(
            decision_from=start,
            decision_to=end,
            cutoff=cutoff,
            timezone="Europe/London",
            error_sign="forecast minus actual",
        ),
    )


@app.get("/api/health")
def health():
    try:
        _, _, provenance = load_snapshot()
        return {"status": "ok", "snapshot_fetched_at": provenance["fetched_at"]}
    except FileNotFoundError:
        raise HTTPException(503, "Data snapshot is not available")


@app.get("/api/analysis")
def analysis(
    decision_from: str = "2026-01-01",
    decision_to: str = "2026-01-31",
    cutoff: str = Query(
        "09:00", description="Configurable assumed decision time in London"
    ),
):
    validate(decision_from, decision_to, cutoff)
    return result(decision_from, decision_to, cutoff)


@app.get("/api/export")
def export(
    decision_from: str = "2026-01-01",
    decision_to: str = "2026-01-31",
    cutoff: str = "09:00",
):
    validate(decision_from, decision_to, cutoff)
    rows = result(decision_from, decision_to, cutoff)["rows"]
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="windward-analysis.csv"'},
    )


# Mount the compiled React app last so it cannot shadow API routes.
_dist = Path(__file__).resolve().parents[1] / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
