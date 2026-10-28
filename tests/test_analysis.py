"""Regression tests for decision-time integrity, time alignment, and metrics."""

from math import sqrt
import pytest
from fastapi.testclient import TestClient
from backend.analysis import analyse, metrics, quantile
from backend.main import app
from backend.data import load_snapshot


def forecast(publication, value, target="2026-01-02T00:00:00Z"):
    return {"startTime": target, "publishTime": publication, "generation": value}


def actual(target, value, fuel="WIND", publication="2026-01-03T00:00:00Z"):
    return {
        "startTime": target,
        "publishTime": publication,
        "generation": value,
        "fuelType": fuel,
    }


def test_latest_publication_at_cutoff_and_no_lookahead():
    records = [
        forecast("2026-01-01T10:30:00Z", 999),
        forecast("2026-01-01T07:30:00Z", 100),
        forecast("2026-01-01T09:00:00Z", 120),
    ]
    row = analyse(records, [], "2026-01-01", "2026-01-01")["rows"][0]
    assert row["forecast_mw"] == 120
    assert row["publish_time"] == "2026-01-01T09:00:00Z"


def test_hourly_actual_is_mean_not_sum_and_other_fuel_excluded():
    records = [
        actual("2026-01-02T00:00:00Z", 80),
        actual("2026-01-02T00:30:00Z", 100),
        actual("2026-01-02T00:00:00Z", 9000, "GAS"),
    ]
    row = analyse(
        [forecast("2026-01-01T07:30:00Z", 120)], records, "2026-01-01", "2026-01-01"
    )["rows"][0]
    assert row["actual_mw"] == 90
    assert row["error_mw"] == 30


def test_missing_half_hour_is_not_filled_or_treated_as_zero():
    result = analyse(
        [forecast("2026-01-01T07:30:00Z", 0)],
        [actual("2026-01-02T00:00:00Z", 0)],
        "2026-01-01",
        "2026-01-01",
    )
    assert result["rows"][0]["forecast_mw"] == 0
    assert result["rows"][0]["actual_mw"] is None
    assert result["summary"]["count"] == 0
    assert result["summary"]["mae_mw"] is None


def test_no_forecast_before_cutoff_stays_missing():
    result = analyse(
        [forecast("2026-01-01T10:30:00Z", 100)], [], "2026-01-01", "2026-01-01"
    )
    assert result["rows"][0]["forecast_mw"] is None
    assert result["summary"]["forecast_hours"] == 0


def test_latest_actual_revision_selected_regardless_of_input_order():
    records = [
        actual("2026-01-02T00:00:00Z", 50, publication="2026-01-04T00:00:00Z"),
        actual("2026-01-02T00:00:00Z", 100),
        actual("2026-01-02T00:30:00Z", 70),
    ]
    result = analyse([], records, "2026-01-01", "2026-01-01")
    assert result["rows"][0]["actual_mw"] == 60


def test_january_decisions_include_february_first_delivery():
    result = analyse([], [], "2026-01-01", "2026-01-31")
    assert len(result["rows"]) == 744
    assert result["rows"][0]["start_time"] == "2026-01-02T00:00:00Z"
    assert result["rows"][-1]["start_time"] == "2026-02-01T23:00:00Z"


def test_error_metrics_and_zero_actual_denominator():
    result = metrics(
        [{"error_mw": 3, "actual_mw": 10}, {"error_mw": -1, "actual_mw": 10}]
    )
    assert result["mae_mw"] == 2
    assert result["rmse_mw"] == pytest.approx(sqrt(5))
    assert result["bias_mw"] == 1
    assert result["wape_pct"] == 20
    assert result["shortfall_mwh"] == 3
    assert metrics([{"error_mw": 1, "actual_mw": 0}])["wape_pct"] is None
    assert quantile(list(range(1, 11)), 0.9) == 9


def test_real_snapshot_has_full_coverage_and_no_late_publications():
    forecasts, actuals, provenance = load_snapshot()
    result = analyse(forecasts, actuals, "2026-01-01", "2026-01-31")
    assert provenance["synthetic"] is False
    assert result["summary"]["count"] == 744
    assert all(row["publish_time"] <= row["decision_time"] for row in result["rows"])


client = TestClient(app)


@pytest.mark.parametrize(
    "query",
    [
        "decision_from=2025-12-31",
        "decision_to=2026-02-01",
        "decision_from=2026-01-20&decision_to=2026-01-01",
        "cutoff=25:00",
        "cutoff=bad",
        "cutoff=09:00:00",
        "decision_from=bad",
    ],
)
def test_api_rejects_invalid_filters(query):
    assert client.get("/api/analysis?" + query).status_code == 422


def test_api_health_analysis_and_csv():
    assert client.get("/api/health").json()["status"] == "ok"
    response = client.get(
        "/api/analysis?decision_from=2026-01-31&decision_to=2026-01-31"
    )
    assert response.status_code == 200
    assert response.json()["summary"]["expected_hours"] == 24
    csv = client.get("/api/export?decision_from=2026-01-31&decision_to=2026-01-31")
    assert csv.status_code == 200
    assert len(csv.text.strip().splitlines()) == 25
    assert "publish_time" in csv.text.splitlines()[0]
