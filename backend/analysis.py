"""Pure, testable as-of selection and hourly forecast accuracy calculations."""

from datetime import date, datetime, time, timedelta, timezone
from math import ceil, sqrt
from statistics import mean
from zoneinfo import ZoneInfo

UTC = timezone.utc
LONDON = ZoneInfo("Europe/London")


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def iso(value):
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def quantile(values, probability):
    """Nearest-rank empirical quantile; deliberately no distribution assumption."""
    return (
        sorted(values)[max(0, ceil(len(values) * probability) - 1)] if values else None
    )


def metrics(rows):
    errors = [row["error_mw"] for row in rows if row["error_mw"] is not None]
    actuals = [row["actual_mw"] for row in rows if row["error_mw"] is not None]
    if not errors:
        return dict(
            count=0,
            mae_mw=None,
            rmse_mw=None,
            bias_mw=None,
            wape_pct=None,
            p90_absolute_error_mw=None,
            shortfall_mwh=None,
        )
    denominator = sum(abs(value) for value in actuals)
    return dict(
        count=len(errors),
        mae_mw=mean(abs(e) for e in errors),
        rmse_mw=sqrt(mean(e * e for e in errors)),
        bias_mw=mean(errors),
        wape_pct=100 * sum(abs(e) for e in errors) / denominator
        if denominator
        else None,
        p90_absolute_error_mw=quantile([abs(e) for e in errors], 0.9),
        shortfall_mwh=sum(max(e, 0) for e in errors),
    )


def analyse(forecasts, actuals, decision_from, decision_to, cutoff="09:00"):
    """Use latest per-target publication <= D cutoff for delivery D+1.

    WINDFOR contains hourly targets. An actual requires both half hours; never
    silently fill a missing interval or use a forecast published after cutoff.
    """
    start, end = date.fromisoformat(decision_from), date.fromisoformat(decision_to)
    cutoff_time = time.fromisoformat(cutoff)
    observations = {}
    for record in actuals:
        if record.get("fuelType") != "WIND" or record.get("generation") is None:
            continue
        target = timestamp(record["startTime"])
        publication = timestamp(record.get("publishTime", record["startTime"]))
        previous = observations.get(target)
        if previous is None or publication > previous[0]:
            observations[target] = (publication, float(record["generation"]))

    candidates = {}
    for record in forecasts:
        if record.get("generation") is None:
            continue
        target = timestamp(record["startTime"])
        candidates.setdefault(target, []).append(
            (timestamp(record["publishTime"]), float(record["generation"]))
        )
    rows = []
    day = start
    while day <= end:
        decision = datetime.combine(day, cutoff_time, LONDON).astimezone(UTC)
        delivery = day + timedelta(days=1)
        for hour in range(24):
            target = datetime.combine(delivery, time(hour), LONDON).astimezone(UTC)
            eligible = [
                item for item in candidates.get(target, []) if item[0] <= decision
            ]
            latest = max(eligible, key=lambda item: item[0]) if eligible else None
            halves = [
                observations.get(target + timedelta(minutes=offset))
                for offset in (0, 30)
            ]
            actual = mean(item[1] for item in halves) if all(halves) else None
            forecast = latest[1] if latest else None
            rows.append(
                dict(
                    decision_date=day.isoformat(),
                    decision_time=iso(decision),
                    delivery_date=delivery.isoformat(),
                    start_time=iso(target),
                    publish_time=iso(latest[0]) if latest else None,
                    forecast_mw=forecast,
                    actual_mw=actual,
                    error_mw=forecast - actual
                    if forecast is not None and actual is not None
                    else None,
                    forecast_age_hours=(decision - latest[0]).total_seconds() / 3600
                    if latest
                    else None,
                    lead_hours=(target - latest[0]).total_seconds() / 3600
                    if latest
                    else None,
                )
            )
        day += timedelta(days=1)
    summary = metrics(rows)
    summary.update(
        expected_hours=len(rows),
        forecast_hours=sum(r["forecast_mw"] is not None for r in rows),
        actual_hours=sum(r["actual_mw"] is not None for r in rows),
        coverage_pct=100 * summary["count"] / len(rows) if rows else 0,
    )
    daily = []
    day = start
    while day <= end:
        subset = [r for r in rows if r["decision_date"] == day.isoformat()]
        daily.append(dict(decision_date=day.isoformat(), **metrics(subset)))
        day += timedelta(days=1)
    return dict(summary=summary, daily=daily, rows=rows)
